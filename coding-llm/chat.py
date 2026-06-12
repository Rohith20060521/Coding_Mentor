from transformers import AutoTokenizer, AutoModelForCausalLM
import torch

model_path = "./qwen-coding-model"

print("Loading model... Please wait.")

tokenizer = AutoTokenizer.from_pretrained(model_path)
model = AutoModelForCausalLM.from_pretrained(model_path)

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model.to(device)

print("Coding Assistant Ready!")
print("Type 'exit' to quit.\n")

while True:
    prompt = input("You: ")

    if prompt.lower() == "exit":
        print("Goodbye!")
        break

    text = f"Instruction: {prompt}\nAnswer:"

    inputs = tokenizer(
        text,
        return_tensors="pt",
        truncation=True
    )

    inputs = {k: v.to(device) for k, v in inputs.items()}

    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=100,
            repetition_penalty=1.1,
            pad_token_id=tokenizer.eos_token_id
        )

    result = tokenizer.decode(
        outputs[0],
        skip_special_tokens=True
    )

    answer = result.replace(text, "").strip()

    print("\nAI:", answer)
    print()