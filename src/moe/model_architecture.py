import numpy as np

def rms_norm(x, weight, eps=1e-6):
    """Root Mean Square Layer Normalization (standard in LLaMA / DeepSeek / Mixtral)."""
    variance = np.mean(np.square(x), axis=-1, keepdims=True)
    return x * (1.0 / np.sqrt(variance + eps)) * weight

def silu(x):
    """SiLU (Swish) activation function."""
    return x * (1.0 / (1.0 + np.exp(-np.clip(x, -30, 30))))

def swiglu_forward(x, w_gate, w_up, w_down):
    """
    SwiGLU feed-forward transformation:
    output = (SiLU(x @ w_gate) * (x @ w_up)) @ w_down
    """
    gate = silu(x @ w_gate)
    up = x @ w_up
    return (gate * up) @ w_down

def softmax(x):
    e_x = np.exp(x - np.max(x, axis=-1, keepdims=True))
    return e_x / np.sum(e_x, axis=-1, keepdims=True)

def precompute_freqs_cis(dim: int, end: int, theta: float = 10000.0):
    """Precomputes Rotary Positional Embedding (RoPE) frequency tensors."""
    freqs = 1.0 / (theta ** (np.arange(0, dim, 2)[: (dim // 2)] / dim))
    t = np.arange(end)
    freqs = np.outer(t, freqs)
    freqs_cos = np.cos(freqs)
    freqs_sin = np.sin(freqs)
    return freqs_cos, freqs_sin

def apply_rotary_emb(xq, freqs_cos, freqs_sin, pos):
    """Applies RoPE to Query / Key vectors."""
    cos = freqs_cos[pos]
    sin = freqs_sin[pos]
    
    # Split even and odd components
    xq_r = xq[..., :xq.shape[-1]//2]
    xq_i = xq[..., xq.shape[-1]//2:]
    
    out_r = xq_r * cos - xq_i * sin
    out_i = xq_r * sin + xq_i * cos
    return np.concatenate([out_r, out_i], axis=-1)
