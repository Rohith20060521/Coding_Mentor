from datasets import load_dataset
from transformers import (
    AutoTokenizer,
    AutoModelForCausalLM,
    TrainingArguments,
    Trainer,
    DataCollatorForLanguageModeling
)
from peft import LoraConfig, get_peft_model

model_name = "Qwen/Qwen2.5-Coder-0.5B-Instruct"

print("Loading tokenizer...")
tokenizer = AutoTokenizer.from_pretrained(model_name)
tokenizer.pad_token = tokenizer.eos_token

print("Loading model...")
model = AutoModelForCausalLM.from_pretrained(model_name)

lora_config = LoraConfig(
    r=8,
    lora_alpha=16,
    lora_dropout=0.05,
    bias="none",
    task_type="CAUSAL_LM"
)

model = get_peft_model(model, lora_config)

print("Loading dataset...")
dataset = load_dataset(
    "json",
    data_files="expanded_dataset.jsonl"
)["train"]

def tokenize(example):
    text = f"Instruction: {example['instruction']}\nAnswer: {example['output']}"

    return tokenizer(
        text,
        truncation=True,
        padding="max_length",
        max_length=256
    )

tokenized = dataset.map(tokenize)

training_args = TrainingArguments(
    output_dir="./qwen-coding-model",
    num_train_epochs=1,
    per_device_train_batch_size=1,
    gradient_accumulation_steps=2,
    learning_rate=2e-4,
    logging_steps=1,
    save_steps=20,
    report_to="none"
)

trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=tokenized,
    data_collator=DataCollatorForLanguageModeling(
        tokenizer=tokenizer,
        mlm=False
    )
)

print("Dataset size:", len(tokenized))
print("Training started...")

trainer.train()

print("Training complete!")

model.save_pretrained("./qwen-coding-model")
tokenizer.save_pretrained("./qwen-coding-model")

print("Model saved successfully!")