import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from rules import analyze, critical_hit


def test_incendio_e_critico():
    r = analyze("Fumaça saindo da loja 12", None)
    assert r["priority"] == "CRITICA" and r["critical"] and r["rule"] == "deterministica"


def test_gas_e_critico():
    assert critical_hit("cheiro de gás na praça de alimentação") == "gas"


def test_critico_prevalece_sobre_categoria_baixa():
    r = analyze("lixo no chão e alguém desmaiou", "Limpeza")
    assert r["priority"] == "CRITICA"


def test_recorrencia_eleva_prioridade():
    base = analyze("lâmpada queimada no corredor leste", "Elétrica", "Corredor", 0)
    rec = analyze("lâmpada queimada no corredor leste", "Elétrica", "Corredor", 3)
    order = ["BAIXA", "MEDIA", "ALTA", "CRITICA"]
    assert order.index(rec["priority"]) > order.index(base["priority"])


def test_sugere_categoria():
    assert analyze("vazamento de agua na torneira do banheiro", None)["category"] == "Hidráulica"


def test_justificativa_sempre_presente():
    assert analyze("teste simples de descricao", None)["justification"]
