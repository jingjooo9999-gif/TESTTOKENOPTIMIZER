import os
import sys
import json
import mmap
import struct
import numpy as np

# Ensure UTF-8 output on Windows
sys.stdout.reconfigure(encoding='utf-8')

DTYPE_MAP = {
    "F32": np.float32,
    "F16": np.float16,
    "I32": np.int32,
    "I16": np.int16,
    "I8":  np.int8,
    "U8":  np.uint8,
    "BOOL": np.bool_
}

def decode_bfloat16_to_f32(bf16_bytes):
    """Fast vectorized conversion from BFloat16 uint16 buffer to Float32."""
    u16 = np.frombuffer(bf16_bytes, dtype=np.uint16)
    u32 = u16.astype(np.uint32) << 16
    return u32.view(np.float32)

class SafeTensorsStreamer:
    """
    Direct Memory-Mapped SafeTensors File Streamer.
    Reads arbitrary tensors from single or multi-shard Hugging Face SafeTensors
    without copying the entire model into RAM.
    """
    def __init__(self, model_dir_or_file):
        self.files = {}
        self.mmaps = {}
        self.tensor_index = {} # tensor_name -> { "file": filename, "dtype": str, "shape": list, "offsets": [start, end], "data_start": int }
        
        if os.path.isdir(model_dir_or_file):
            index_path = os.path.join(model_dir_or_file, "model.safetensors.index.json")
            if os.path.exists(index_path):
                with open(index_path, "r", encoding="utf-8") as f:
                    index_data = json.load(f)
                    weight_map = index_data.get("weight_map", {})
                    
                unique_shards = set(weight_map.values())
                for shard_name in unique_shards:
                    shard_path = os.path.join(model_dir_or_file, shard_name)
                    self._mount_safetensors_file(shard_path, shard_name)
            else:
                # Single safetensors in dir
                st_files = [f for f in os.listdir(model_dir_or_file) if f.endswith(".safetensors")]
                for st in st_files:
                    self._mount_safetensors_file(os.path.join(model_dir_or_file, st), st)
        else:
            self._mount_safetensors_file(model_dir_or_file, os.path.basename(model_dir_or_file))

        print(f"📦 Mounted SafeTensors Streamer: {len(self.tensor_index)} tensors indexed across {len(self.mmaps)} file(s).")

    def _mount_safetensors_file(self, filepath, key_name):
        f = open(filepath, "rb")
        mapped = mmap.mmap(f.fileno(), 0, access=mmap.ACCESS_READ)
        self.files[key_name] = f
        self.mmaps[key_name] = mapped
        
        # Read 8-byte unsigned long long for header size
        header_len = struct.unpack("<Q", mapped[:8])[0]
        header_bytes = mapped[8 : 8 + header_len]
        header_json = json.loads(header_bytes.decode("utf-8"))
        data_start = 8 + header_len
        
        for tensor_name, meta in header_json.items():
            if tensor_name == "__metadata__":
                continue
            self.tensor_index[tensor_name] = {
                "file": key_name,
                "dtype": meta.get("dtype", "F32"),
                "shape": meta.get("shape", []),
                "offsets": meta.get("data_offsets", [0, 0]),
                "data_start": data_start
            }

    def get_tensor(self, tensor_name):
        """Streams a single tensor slice directly from SSD into a NumPy array."""
        if tensor_name not in self.tensor_index:
            raise KeyError(f"Tensor '{tensor_name}' not found in SafeTensors index.")
            
        info = self.tensor_index[tensor_name]
        mapped = self.mmaps[info["file"]]
        start = info["data_start"] + info["offsets"][0]
        end = info["data_start"] + info["offsets"][1]
        shape = info["shape"]
        dtype_str = info["dtype"]
        
        raw_slice = mapped[start:end]
        
        if dtype_str == "BF16":
            arr = decode_bfloat16_to_f32(raw_slice).reshape(shape)
        elif dtype_str in DTYPE_MAP:
            arr = np.frombuffer(raw_slice, dtype=DTYPE_MAP[dtype_str]).reshape(shape)
        else:
            arr = np.frombuffer(raw_slice, dtype=np.float32).reshape(shape)
            
        return arr.astype(np.float32)

    def close(self):
        for m in self.mmaps.values():
            m.close()
        for f in self.files.values():
            f.close()
