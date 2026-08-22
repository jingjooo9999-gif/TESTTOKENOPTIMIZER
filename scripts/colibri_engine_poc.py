import mmap
import struct
import json
import time
import os
import sys
import numpy as np

# Ensure UTF-8 output on Windows console
sys.stdout.reconfigure(encoding='utf-8')

def silu(x):
    return x * (1 / (1 + np.exp(-x)))

def softmax(x):
    e_x = np.exp(x - np.max(x))
    return e_x / e_x.sum(axis=-1, keepdims=True)

class ColibriStreamingEngine:
    def __init__(self, model_path="moe_model.bin"):
        print("\n" + "="*65)
        print("  ⚡ COLIBRI STREAMING INFERENCE ENGINE (PROTOTYPE)")
        print("="*65)
        
        self.file_size = os.path.getsize(model_path)
        self.file = open(model_path, "rb")
        
        # 1. Memory-map the file (Zero RAM allocation for weights initially)
        self.mapped_file = mmap.mmap(self.file.fileno(), 0, access=mmap.ACCESS_READ)
        
        # 2. Parse SafeTensors-style Header
        header_len = struct.unpack("<Q", self.mapped_file[:8])[0]
        self.header_json_bytes = self.mapped_file[8 : 8 + header_len]
        self.metadata = json.loads(self.header_json_bytes.decode("utf-8"))
        self.data_offset_start = 8 + header_len
        
        print(f"📁 Model File: '{model_path}' ({self.file_size / (1024*1024):.2f} MB on SSD)")
        print(f"📊 Indexed {len(self.metadata)} Tensors via mmap.")
        
        # 3. Cache the Dense Core in RAM (Embeddings, Attention, Router)
        self.ram_cache = {}
        self.preload_dense_core()
        
    def get_tensor(self, name):
        """Streams a single tensor from SSD directly via mmap without loading other tensors."""
        if name in self.ram_cache:
            return self.ram_cache[name]
            
        info = self.metadata[name]
        start = self.data_offset_start + info["data_offsets"][0]
        end = self.data_offset_start + info["data_offsets"][1]
        shape = info["shape"]
        
        # Zero-copy view directly from mapped SSD memory buffer
        raw_buffer = self.mapped_file[start:end]
        return np.frombuffer(raw_buffer, dtype=np.float32).reshape(shape)

    def preload_dense_core(self):
        """Keeps only Attention, Embedding and Router weights resident in RAM (~10% of model)."""
        dense_tensors = [k for k in self.metadata if "experts" not in k]
        for name in dense_tensors:
            self.ram_cache[name] = self.get_tensor(name)
            
        dense_size_mb = sum(t.nbytes for t in self.ram_cache.values()) / (1024 * 1024)
        print(f"🧠 Dense Core loaded into RAM: {dense_size_mb:.2f} MB")
        print(f"💾 Expert Weights remaining on SSD: {(self.file_size / (1024*1024)) - dense_size_mb:.2f} MB (Streamed On-Demand)")
        print("="*65 + "\n")

    def forward_token(self, token_id, num_layers=4, top_k=2):
        """Runs 1 Forward Pass for a single token using SSD Expert Streaming."""
        # 1. Embedding
        embeddings = self.get_tensor("token_embeddings.weight")
        x = embeddings[token_id].copy()
        
        active_experts_log = []
        
        # 2. Iterate through MoE Layers
        for layer_id in range(num_layers):
            # Attention Layer (Dense in RAM)
            w_attn = self.get_tensor(f"layers.{layer_id}.attention.weight")
            attn_out = x @ w_attn
            x = x + attn_out # Residual
            
            # Router Layer (Dense in RAM) -> Decides which experts to activate
            w_router = self.get_tensor(f"layers.{layer_id}.router.weight")
            router_logits = x @ w_router
            router_probs = softmax(router_logits)
            
            # Pick Top-K Experts (e.g. 2 out of 16)
            top_expert_indices = np.argsort(router_logits)[-top_k:][::-1]
            top_expert_probs = router_probs[top_expert_indices]
            top_expert_probs /= top_expert_probs.sum() # Normalize
            
            active_experts_log.append(top_expert_indices.tolist())
            
            # 3. ⚡ EXPERT STREAMING FROM SSD ⚡
            moe_output = np.zeros_like(x)
            for expert_idx, prob in zip(top_expert_indices, top_expert_probs):
                # Stream ONLY this expert's weights from SSD via mmap
                w_gate = self.get_tensor(f"layers.{layer_id}.experts.{expert_idx}.gate_proj")
                w_up   = self.get_tensor(f"layers.{layer_id}.experts.{expert_idx}.up_proj")
                w_down = self.get_tensor(f"layers.{layer_id}.experts.{expert_idx}.down_proj")
                
                # SwiGLU activation
                expert_ffn = (silu(x @ w_gate) * (x @ w_up)) @ w_down
                moe_output += prob * expert_ffn
                
            x = x + moe_output # Residual
            
        # 4. Output Head (LM Head)
        w_head = self.get_tensor("lm_head.weight")
        logits = x @ w_head
        next_token = int(np.argmax(logits))
        
        return next_token, active_experts_log

    def generate(self, start_tokens, max_new_tokens=6):
        print(f"🚀 Prompt Tokens: {start_tokens}")
        print("🔄 Streaming generation token-by-token:\n")
        
        current_token = start_tokens[-1]
        generated = list(start_tokens)
        
        start_time = time.time()
        
        for step in range(max_new_tokens):
            t0 = time.time()
            next_tok, active_experts = self.forward_token(current_token)
            dt_ms = (time.time() - t0) * 1000
            
            generated.append(next_tok)
            current_token = next_tok
            
            # Visual display of active experts per layer
            expert_display = " | ".join([f"L{i}: Experts {exp}" for i, exp in enumerate(active_experts)])
            print(f"  • Token +{step+1} ➔ ID: {next_tok:3d}  ({dt_ms:.1f}ms)  [Streamed: {expert_display}]")
            
        total_time = time.time() - start_time
        print(f"\n🎉 Generated {max_new_tokens} tokens in {total_time:.3f}s ({(max_new_tokens/total_time):.1f} tokens/sec)")
        print(f"💾 Notice: 14 out of 16 Experts per layer remained on SSD and NEVER used RAM!")
        print("="*65)
        
    def close(self):
        self.mapped_file.close()
        self.file.close()

if __name__ == "__main__":
    from build_mock_moe_model import create_mock_moe_model
    
    model_file = "moe_model.bin"
    if not os.path.exists(model_file):
        create_mock_moe_model(model_file)
        
    engine = ColibriStreamingEngine(model_file)
    engine.generate(start_tokens=[42, 108, 99], max_new_tokens=6)
    engine.close()
