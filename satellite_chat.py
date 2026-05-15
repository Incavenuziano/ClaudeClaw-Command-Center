#!/usr/bin/env python3
"""
Satellite Chat via Claude CLI
Usa a assinatura do Claude Code
"""

import sys
import json
import subprocess

SYSTEM_PROMPTS = {
    "adv": "Você é o assistente jurídico do Dr. Danilo Almeida, advogado OAB/DF 59.724. Responda de forma profissional e concisa.",
    "araticum": "Você é o assistente da Araticum Consultoria, especializada em licitações públicas e Lei 14.133/2021. Responda de forma técnica e objetiva.",
    "designer": "Você é um assistente de design criativo. Responda de forma criativa e visual.",
    "claudeclaw": "Você é o ClaudeClaw, assistente pessoal do Danilo. Seja direto, amigável e útil. Responda em português brasileiro.",
}

def chat(satellite_id: str, message: str) -> str:
    system_prompt = SYSTEM_PROMPTS.get(satellite_id, SYSTEM_PROMPTS["claudeclaw"])

    full_prompt = f"[Sistema: {system_prompt}]\n\nUsuário: {message}\n\nResponda de forma concisa (máximo 2 parágrafos)."

    try:
        result = subprocess.run(
            ["/home/danilo/.local/bin/claude", "-p", full_prompt, "--output-format", "text"],
            capture_output=True,
            text=True,
            timeout=60,
        )
        output = result.stdout.strip()
        if output:
            return output
        if result.stderr:
            return f"Erro: {result.stderr.strip()}"
        return "Sem resposta"
    except subprocess.TimeoutExpired:
        return "Erro: timeout (60s)"
    except Exception as e:
        return f"Erro: {str(e)}"

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Uso: satellite_chat.py <satellite_id> <message>"}))
        sys.exit(1)

    satellite_id = sys.argv[1]
    message = " ".join(sys.argv[2:])

    result = chat(satellite_id, message)
    print(json.dumps({"response": result}))
