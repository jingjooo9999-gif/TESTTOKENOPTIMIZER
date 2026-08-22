import os
import sys
import json
import struct
import numpy as np

# Ensure UTF-8 output on Windows
sys.stdout.reconfigure(encoding='utf-8')

def build_hf_moe_safetensors_repo(output_dir="models/Mixtral-Mini-MoE", vocab_size=1000, hidden_dim=256, num_layers=4, num_experts=16):
    os.makedirs(output_dir, exist_ok=True)
    print(f"📦 Generating HuggingFace SafeTensors MoE Model in '{output_dir}'...")

    # 1. Write standard HuggingFace config.json
    config = {
        "architectures": ["MixtralForCausalLM"],
        "model_type": "mixtral",
        "vocab_size": vocab_size,
        "hidden_size": hidden_dim,
        "intermediate_size": hidden_dim * 2,
        "num_hidden_layers": num_layers,
        "num_attention_heads": 8,
        "num_key_value_heads": 8,
        "num_local_experts": num_experts,
        "num_experts_per_tok": 2,
        "rms_norm_eps": 1e-5,
        "torch_dtype": "float32"
    }

    with open(os.path.join(output_dir, "config.json"), "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)

    # 2. Build SafeTensors Binary
    tensors_metadata = {}
    current_offset = 0
    binary_payload = bytearray()

    def add_tensor(name, shape):
        nonlocal current_offset, binary_payload
        weights = (np.random.randn(*shape) * 0.02).astype(np.float32)
        raw_bytes = weights.tobytes()
        
        start = current_offset
        end = current_offset + len(raw_bytes)
        binary_payload.extend(raw_bytes)
        current_offset = end
        
        tensors_metadata[name] = {
            "dtype": "F32",
            "shape": list(shape),
            "data_offsets": [start, end]
        }

    # Model Embeddings & Output
    add_tensor("model.embed_tokens.weight", (vocab_size, hidden_dim))
    add_tensor("model.norm.weight", (hidden_dim,))
    add_tensor("lm_head.weight", (hidden_dim, vocab_size))

    # Layers
    for i in range(num_layers):
        add_tensor(f"model.layers.{i}.input_layernorm.weight", (hidden_dim,))
        add_tensor(f"model.layers.{i}.self_attn.q_proj.weight", (hidden_dim, hidden_dim))
        add_tensor(f"model.layers.{i}.self_attn.k_proj.weight", (hidden_dim, hidden_dim))
        add_tensor(f"model.layers.{i}.self_attn.v_proj.weight", (hidden_dim, hidden_dim))
        add_tensor(f"model.layers.{i}.self_attn.o_proj.weight", (hidden_dim, hidden_dim))
        add_tensor(f"model.layers.{i}.post_attention_layernorm.weight", (hidden_dim,))
        
        # Router Gate
        add_tensor(f"model.layers.{i}.block_sparse_moe.gate.weight", (hidden_dim, num_experts))
        
        # 16 Experts per layer
        for e in range(num_experts):
            add_tensor(f"model.layers.{i}.block_sparse_moe.experts.{e}.w1.weight", (hidden_dim, hidden_dim * 2)) # gate_proj
            add_tensor(f"model.layers.{i}.block_sparse_moe.experts.{e}.w3.weight", (hidden_dim, hidden_dim * 2)) # up_proj
            add_tensor(f"model.layers.{i}.block_sparse_moe.experts.{e}.w2.weight", (hidden_dim * 2, hidden_dim)) # down_proj

    # Serialize SafeTensors File
    header_json = json.dumps(tensors_metadata).encode("utf-8")
    header_len = len(header_json)

    safetensors_file = os.path.join(output_dir, "model.safetensors")
    with open(safetensors_file, "wb") as f:
        f.write(struct.pack("<Q", header_len))
        f.write(header_json)
        f.write(binary_payload)

    total_mb = os.path.getsize(safetensors_file) / (1024 * 1024)
    print(f"✅ SafeTensors Model Written: '{safetensors_file}' ({total_mb:.2f} MB)")
    return output_dir

if __name__ == "__main__":
    build_hf_moe_safetensors_repo()
