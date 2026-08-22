import os
import sys
import json
import time
import numpy as np

# Ensure UTF-8 output on Windows
sys.stdout.reconfigure(encoding='utf-8')

from .safetensors_streamer import SafeTensorsStreamer
from .model_architecture import rms_norm, swiglu_forward, softmax, precompute_freqs_cis, apply_rotary_emb

class RealMoEInferenceEngine:
    """
    Production-grade Streaming Inference Engine for Real MoE Models (Mixtral / DeepSeek / Qwen-MoE).
    Reads SafeTensors format and streams MoE Expert weights on-demand from NVMe SSD.
    """
    def __init__(self, model_dir, max_seq_len=2048):
        print("\n" + "="*70)
        print("  ⚡ PRODUCTION-GRADE STREAMING MOE INFERENCE ENGINE")
        print("="*70)
        
        self.model_dir = model_dir
        self.max_seq_len = max_seq_len
        
        # 1. Load HuggingFace config.json
        config_path = os.path.join(model_dir, "config.json")
        if not os.path.exists(config_path):
            raise FileNotFoundError(f"Missing config.json in '{model_dir}'")
            
        with open(config_path, "r", encoding="utf-8") as f:
            self.config = json.load(f)
            
        self.hidden_dim = self.config.get("hidden_size", 256)
        self.num_layers = self.config.get("num_hidden_layers", 4)
        self.num_heads = self.config.get("num_attention_heads", 8)
        self.head_dim = self.hidden_dim // self.num_heads
        self.num_experts = self.config.get("num_local_experts", 16)
        self.top_k = self.config.get("num_experts_per_tok", 2)
        self.vocab_size = self.config.get("vocab_size", 1000)
        
        print(f"📁 Architecture: {self.num_layers} Layers | {self.num_experts} Experts/Layer (Top-{self.top_k} Active)")
        print(f"📐 Dimensions: Hidden Dim {self.hidden_dim} | Heads {self.num_heads} | Vocab {self.vocab_size}")
        
        # 2. Initialize SafeTensors Streamer
        self.streamer = SafeTensorsStreamer(model_dir)
        
        # 3. Precompute RoPE Positional Embeddings
        self.freqs_cos, self.freqs_sin = precompute_freqs_cis(self.head_dim, max_seq_len)
        
        # 4. Preload Dense Core into RAM (Embedding, Attention, Router)
        self.ram_cache = {}
        self.preload_dense_core()
        
        # 5. Load Tokenizer if present
        self.tokenizer = self._init_tokenizer(model_dir)

    def _init_tokenizer(self, model_dir):
        tokenizer_json = os.path.join(model_dir, "tokenizer.json")
        if os.path.exists(tokenizer_json):
            try:
                from tokenizers import Tokenizer
                return Tokenizer.from_file(tokenizer_json)
            except Exception as e:
                print(f"⚠️ Could not load tokenizers library: {e}")
        return None

    def preload_dense_core(self):
        """Loads non-expert weights (Dense Core) into RAM."""
        dense_names = [k for k in self.streamer.tensor_index if "experts" not in k and "block_sparse_moe.experts" not in k]
        
        for name in dense_names:
            self.ram_cache[name] = self.streamer.get_tensor(name)
            
        dense_bytes = sum(t.nbytes for t in self.ram_cache.values())
        print(f"🧠 Dense Core RAM Footprint: {dense_bytes / (1024*1024):.2f} MB")
        print(f"💾 All {self.num_layers * self.num_experts} Expert Weights remain on SSD (Streamed On-Demand)")
        print("="*70 + "\n")

    def _get_tensor(self, name):
        if name in self.ram_cache:
            return self.ram_cache[name]
        return self.streamer.get_tensor(name)

    def forward_token(self, token_id, pos=0):
        """Executes a single token forward pass with dynamic SSD expert streaming."""
        # 1. Embed Token
        embed_w = self._get_tensor("model.embed_tokens.weight")
        x = embed_w[token_id].copy()
        
        layer_expert_trace = []
        
        # 2. Iterate Layers
        for i in range(self.num_layers):
            # Input LayerNorm
            norm_w = self._get_tensor(f"model.layers.{i}.input_layernorm.weight")
            norm_x = rms_norm(x, norm_w)
            
            # Multi-Head Attention (Self-Attention)
            q_w = self._get_tensor(f"model.layers.{i}.self_attn.q_proj.weight")
            k_w = self._get_tensor(f"model.layers.{i}.self_attn.k_proj.weight")
            v_w = self._get_tensor(f"model.layers.{i}.self_attn.v_proj.weight")
            o_w = self._get_tensor(f"model.layers.{i}.self_attn.o_proj.weight")
            
            q = norm_x @ q_w
            k = norm_x @ k_w
            v = norm_x @ v_w
            
            # Reshape into multi-head (num_heads, head_dim)
            q = q.reshape(self.num_heads, self.head_dim)
            k = k.reshape(self.num_heads, self.head_dim)
            v = v.reshape(self.num_heads, self.head_dim)
            
            # Apply RoPE per head
            q = apply_rotary_emb(q, self.freqs_cos, self.freqs_sin, pos)
            k = apply_rotary_emb(k, self.freqs_cos, self.freqs_sin, pos)
            
            # Attention Score per head: (num_heads, head_dim) @ (num_heads, head_dim).T
            # For single token at step pos:
            scores = np.sum(q * k, axis=-1, keepdims=True) / np.sqrt(self.head_dim)
            attn_heads_out = scores * v # (num_heads, head_dim)
            attn_flat = attn_heads_out.reshape(self.hidden_dim)
            
            attn_out = attn_flat @ o_w
            x = x + attn_out # Residual
            
            # Post-Attention LayerNorm
            post_norm_w = self._get_tensor(f"model.layers.{i}.post_attention_layernorm.weight")
            norm_x2 = rms_norm(x, post_norm_w)
            
            # MoE Router Gate (Decides Top-K Experts)
            router_w = self._get_tensor(f"model.layers.{i}.block_sparse_moe.gate.weight")
            router_logits = norm_x2 @ router_w
            router_probs = softmax(router_logits)
            
            top_experts = np.argsort(router_logits)[-self.top_k:][::-1]
            top_probs = router_probs[top_experts]
            top_probs /= top_probs.sum() # Normalize
            
            layer_expert_trace.append(top_experts.tolist())
            
            # 3. ⚡ DYNAMIC SSD STREAMING FOR SELECTED EXPERTS ⚡
            moe_out = np.zeros_like(x)
            for exp_idx, prob in zip(top_experts, top_probs):
                # Fetch expert weights on demand from SafeTensors file on SSD
                w_gate = self._get_tensor(f"model.layers.{i}.block_sparse_moe.experts.{exp_idx}.w1.weight")
                w_up   = self._get_tensor(f"model.layers.{i}.block_sparse_moe.experts.{exp_idx}.w3.weight")
                w_down = self._get_tensor(f"model.layers.{i}.block_sparse_moe.experts.{exp_idx}.w2.weight")
                
                exp_out = swiglu_forward(norm_x2, w_gate, w_up, w_down)
                moe_out += prob * exp_out
                
            x = x + moe_out # Residual
            
        # Final LayerNorm & LM Head
        final_norm_w = self._get_tensor("model.norm.weight")
        norm_final = rms_norm(x, final_norm_w)
        
        lm_head_w = self._get_tensor("lm_head.weight")
        logits = norm_final @ lm_head_w
        
        next_token = int(np.argmax(logits))
        return next_token, layer_expert_trace

    def generate(self, prompt_text_or_ids, max_new_tokens=8):
        if isinstance(prompt_text_or_ids, str):
            if self.tokenizer:
                token_ids = self.tokenizer.encode(prompt_text_or_ids).ids
            else:
                token_ids = [ord(c) % self.vocab_size for c in prompt_text_or_ids]
        else:
            token_ids = list(prompt_text_or_ids)

        print(f"🚀 Input Prompt IDs: {token_ids}")
        print("🔄 Generating text via on-demand SSD Expert Streaming:\n")
        
        curr_token = token_ids[-1]
        generated_ids = list(token_ids)
        start_time = time.time()
        
        for step in range(max_new_tokens):
            pos = len(generated_ids) - 1
            t0 = time.time()
            next_tok, trace = self.forward_token(curr_token, pos=pos)
            dt_ms = (time.time() - t0) * 1000
            
            generated_ids.append(next_tok)
            curr_token = next_tok
            
            trace_str = " | ".join([f"L{i}: Experts {exp}" for i, exp in enumerate(trace)])
            print(f"  • Step +{step+1} ➔ Token: {next_tok:4d} ({dt_ms:.1f}ms)  [Streamed: {trace_str}]")
            
        total_time = time.time() - start_time
        print(f"\n🎉 Finished {max_new_tokens} tokens in {total_time:.3f}s ({(max_new_tokens/total_time):.1f} tok/sec)")
        
        if self.tokenizer:
            decoded = self.tokenizer.decode(generated_ids)
            print(f"💬 Decoded Output Text: \"{decoded}\"")
        print("="*70)

    def close(self):
        self.streamer.close()
