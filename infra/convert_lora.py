#!/usr/bin/env python3
"""
Convert PyTorch/PEFT LoRA adapter weights to MediaPipe FlatBuffer formats.
"""
import argparse
import os
import sys
from mediapipe.tasks.python.genai import converter

def main():
    parser = argparse.ArgumentParser(description="Convert PEFT LoRA adapter to MediaPipe FlatBuffer format")
    parser.add_argument("--base_model_dir", required=True, help="Directory containing the base model checkpoints")
    parser.add_argument("--lora_dir", required=True, help="Directory containing the LoRA adapter checkpoints (e.g. adapter_model.bin / adapter_model.safetensors)")
    parser.add_argument("--output_lora_path", required=True, help="Output path for the converted LoRA flatbuffer (e.g. lora.bin)")
    parser.add_argument("--vocab_model_file", required=True, help="Path to vocab/tokenizer model (e.g. tokenizer.model)")
    parser.add_argument("--lora_rank", type=int, default=8, help="LoRA rank/dimension (default: 8)")
    
    args = parser.parse_args()
    
    print(f"Configuring conversion:")
    print(f"  Base Model: {args.base_model_dir}")
    print(f"  LoRA Adapter: {args.lora_dir}")
    print(f"  Output FlatBuffer: {args.output_lora_path}")
    
    # Ensure output directory exists
    output_dir = os.path.dirname(args.output_lora_path) or "."
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir)
        
    config = converter.ConversionConfig(
        input_ckpt=args.base_model_dir,
        ckpt_format='safetensors',
        model_type='GEMMA_2B',
        vocab_model_file=args.vocab_model_file,
        backend='gpu',
        lora_ckpt=args.lora_dir,
        lora_rank=args.lora_rank,
        lora_output_tflite_file=args.output_lora_path,
        output_dir=output_dir,
        output_tflite_file=os.path.join(output_dir, "base_model.tflite")  # Required parameter for config validation
    )
    
    print("Running MediaPipe convert_checkpoint...")
    try:
        converter.convert_checkpoint(config)
        print(f"Successfully converted LoRA FlatBuffer and saved to {args.output_lora_path}")
    except Exception as e:
        print(f"Error during conversion: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
