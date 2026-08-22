import json
import struct
import numpy as np
import os
import sys

# Ensure UTF-8 output on Windows console
sys.stdout.reconfigure(encoding='utf-8')

"""
Builds a simulated binary MoE Model File (SafeTensors-style layout).
Contains 4 Layers, each with 16 Experts (Total 64 Experts) + Attention & Router.
"""

def create_mock_moe_model(filename="moe_model.bin", vocab_size=500, hidden_dim=256, num_layers=4, num_experts=16):
    print(f"📦 Generating Binary MoE Model '{filename}'...")
    
    tensors = {}
    current_offset = 0
    binary_data = bytearray()

    def add_tensor(name, shape):
        nonlocal current_offset, binary_data
        # Generate initialized float32 weights
        weights = (np.random.randn(*shape) * 0.02).astype(np.float32)
        raw_bytes = weights.tobytes()
        
        start = current_offset
        end = current_offset + len(raw_bytes)
        binary_data.extend(raw_bytes)
        current_offset = end
        
        tensors[name] = {
            "dtype": "F32",
            "shape": list(shape),
            "data_offsets": [start, end]
        }

    # 1. Embedding & Output Head
    add_tensor("token_embeddings.weight", (vocab_size, hidden_dim))
    add_tensor("lm_head.weight", (hidden_dim, vocab_size))

    # 2. Multi-Layer MoE Tensors
    for layer_id in range(num_layers):
        add_tensor(f"layers.{layer_id}.attention.weight", (hidden_dim, hidden_dim))
        add_tensor(f"layers.{layer_id}.router.weight", (hidden_dim, num_experts))
        
        # 16 Experts per layer (MLP Gate, Up, Down)
        for expert_id in range(num_experts):
            add_tensor(f"layers.{layer_id}.experts.{expert_id}.gate_proj", (hidden_dim, hidden_dim * 2))
            add_tensor(f"layers.{layer_id}.experts.{expert_id}.up_proj", (hidden_dim, hidden_dim * 2))
            add_tensor(f"layers.{layer_id}.experts.{expert_id}.down_proj", (hidden_dim * 2, hidden_dim))

    # 3. Write Header + Binary Blobs
    header_json = json.dumps(tensors).encode('utf-8')
    header_len = len(header_json)

    with open(filename, "wb") as f:
        # 8-byte integer for header size (SafeTensors standard)
        f.write(struct.pack("<Q", header_len))
        f.write(header_json)
        f.write(binary_data)

    file_size_mb = os.path.getsize(filename) / (1024 * 1024)
    total_params = sum(int(np.prod(v['shape'])) for v in tensors.values())

    print(f"✅ Model File Created: '{filename}'")
    print(f"   • Total Parameters: {total_params:,} parameters")
    print(f"   • File Size on SSD: {file_size_mb:.2f} MB")
    print(f"   • Layers: {num_layers} layers | Experts: {num_experts} experts/layer (Total {num_layers * num_experts} experts)")
    return filename

if __name__ == "__main__":
    create_mock_moe_model()
