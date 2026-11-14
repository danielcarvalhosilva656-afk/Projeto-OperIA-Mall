"""Regras de priorizacao do OperIA Mall (Etapa 7).

Principio human-in-the-loop: regras deterministicas para situacoes criticas
SEMPRE prevalecem sobre a analise estatistica/semantica.
"""
import re
import unicodedata

PRIORITIES = ["BAIXA", "MEDIA", "ALTA", "CRITICA"]

CRITICAL_PATTERNS = {
    "incendio": r"\b(incendio|fogo|fumaca|chamas|queimando|curto.?circuito)\b",
    "gas": r"\b(vazamento de gas|cheiro de gas|gas vazando|gas)\b",
    "risco a vida": r"\b(risco de vida|risco a vida|desmaio|desmaiou|inconsciente|infarto|convulsao|afogamento|parada cardiaca)\b",
    "violencia": r"\b(briga|agressao|arma|assalto|furto em andamento|ameaca|violencia|tiroteio)\b",
    "emergencia medica": r"\b(emergencia medica|ambulancia|ferido|sangrando|queda de pessoa|acidente com cliente)\b",
    "estrutura": r"\b(desabamento|teto caindo|marquise|rachadura grande)\b",
}

CATEGORY_KEYWORDS = {
    "Segurança": ["briga", "furto", "assalto", "suspeito", "ameaca", "arma", "alarme", "violencia", "agressao"],
    "Elétrica": ["luz", "lampada", "energia", "tomada", "curto", "disjuntor", "fio", "apagao"],
    "Hidráulica": ["vazamento", "agua", "torneira", "descarga", "banheiro", "entupido", "cano", "alagamento", "infiltracao"],
    "Climatização": ["ar condicionado", "ar-condicionado", "climatizacao", "temperatura", "quente", "frio"],
    "Limpeza": ["sujo", "lixo", "derramou", "derramado", "piso molhado", "limpeza", "cheiro", "vomito", "varrer"],
    "Elevadores e Escadas": ["elevador", "escada rolante", "escada", "esteira"],
}

HIGH_HINTS = r"\b(alagamento|elevador parado|escada rolante parada|piso molhado|sem energia|apagao|preso|cliente preso|vazamento)\b"
COMMON_AREAS = ("praca", "corredor", "entrada", "estacionamento", "escada", "banheiro", "alimentacao")


def norm(text: str) -> str:
    text = unicodedata.normalize("NFD", text.lower())
    return "".join(c for c in text if unicodedata.category(c) != "Mn")


def critical_hit(text: str):
    t = norm(text)
    for label, pat in CRITICAL_PATTERNS.items():
        if re.search(pat, t):
            return label
    return None


def suggest_category(text: str):
    t = norm(text)
    best, score = None, 0
    for cat, words in CATEGORY_KEYWORDS.items():
        s = sum(1 for w in words if norm(w) in t)
        if s > score:
            best, score = cat, s
    return best


def bump(priority: str, steps: int = 1) -> str:
    return PRIORITIES[min(PRIORITIES.index(priority) + steps, len(PRIORITIES) - 1)]


def analyze(description: str, category: str | None, location_text: str = "",
            recurrence_count: int = 0, waiting_minutes: int = 0) -> dict:
    """Retorna prioridade sugerida, categoria sugerida e justificativa."""
    text = f"{description} {category or ''}"
    suggested_category = suggest_category(description) or category
    reasons: list[str] = []

    hit = critical_hit(text)
    if hit:
        return {
            "priority": "CRITICA",
            "category": suggested_category,
            "critical": True,
            "rule": "deterministica",
            "justification": f"Regra deterministica: situacao critica detectada ({hit}). "
                             "Escalonamento imediato e revisao humana obrigatoria.",
        }

    priority = "MEDIA"
    t = norm(text)
    if re.search(HIGH_HINTS, t):
        priority = "ALTA"
        reasons.append("palavras indicam impacto na circulacao/operacao")
    if any(a in norm(location_text) for a in COMMON_AREAS):
        priority = bump(priority) if priority != "ALTA" else priority
        reasons.append("area comum com circulacao de pessoas")
    if recurrence_count >= 2:
        priority = bump(priority)
        reasons.append(f"recorrencia no mesmo local ({recurrence_count} registros em 7 dias)")
    if waiting_minutes >= 60:
        priority = bump(priority)
        reasons.append("tempo de espera elevado")
    if not reasons:
        if len(description.strip()) < 15:
            priority = "BAIXA"
            reasons.append("descricao curta sem indicios de impacto")
        else:
            reasons.append("sem indicios de risco ou impacto relevante")
    return {
        "priority": priority,
        "category": suggested_category,
        "critical": False,
        "rule": "semantica",
        "justification": "Sugestao assistida: " + "; ".join(reasons) + ". Sujeita a revisao do gestor.",
    }
