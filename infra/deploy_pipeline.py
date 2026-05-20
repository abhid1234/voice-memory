import os
from google.cloud import aiplatform

# Project and region configuration
PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT", "voice-memory-project")
REGION = "us-central1"
BUCKET_NAME = "voice-memory-infra"

def deploy_training_job():
    aiplatform.init(project=PROJECT_ID, location=REGION, staging_bucket=f"gs://{BUCKET_NAME}")

    # Load configuration from YAML (simplified here for brevity)
    job = aiplatform.CustomJob(
        display_name="voice-memory-weekly-lora",
        worker_pool_specs=[{
            "machine_spec": {
                "machine_type": "n1-standard-8",
                "accelerator_type": "NVIDIA_TESLA_T4",
                "accelerator_count": 1,
            },
            "replica_count": 1,
            "container_spec": {
                "image_uri": "us-docker.pkg.dev/vertex-ai/training/pytorch-gpu.1-13.py310:latest",
                "args": [
                    "--base_model=google/gemma-2b-it",
                    "--lora_rank=8",
                    "--dataset_path=gs://voice-memory-data/weekly_export.jsonl",
                    "--output_dir=gs://voice-memory-models/weekly_lora_delta/",
                ],
            },
        }]
    )

    print("Launching Vertex AI training job...")
    job.run()
    print("Job completed successfully.")

if __name__ == "__main__":
    deploy_training_job()
