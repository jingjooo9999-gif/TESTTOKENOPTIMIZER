import os
import sys

# Ensure UTF-8 output on Windows
sys.stdout.reconfigure(encoding='utf-8')

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.moe.real_moe_engine import RealMoEInferenceEngine
from scripts.generate_real_moe_safetensors import build_hf_moe_safetensors_repo

def main():
    model_dir = "models/Mixtral-Mini-MoE"
    
    # 1. Generate real SafeTensors HuggingFace repo if not present
    if not os.path.exists(os.path.join(model_dir, "model.safetensors")):
        build_hf_moe_safetensors_repo(model_dir)
        
    # 2. Launch Real Streaming Engine
    engine = RealMoEInferenceEngine(model_dir)
    
    # 3. Generate from Prompt
    prompt = [101, 75, 420, 999]
    engine.generate(prompt, max_new_tokens=8)
    
    engine.close()

if __name__ == "__main__":
    main()
