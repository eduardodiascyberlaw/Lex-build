#!/usr/bin/env python3
"""
Gerador de Recurso de Apelação em .docx
Usa o template do escritório como base, preservando cabeçalhos, rodapés,
logótipo, fontes e toda a formatação do papel timbrado.

Uso:
    python gerar_recurso_docx.py --json dados.json --output recurso.docx

O ficheiro JSON deve seguir a estrutura descrita na SKILL.md.
"""

import json
import os
import sys
import tempfile
import zipfile
import argparse

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SKILL_DIR = os.path.dirname(SCRIPT_DIR)

# Template: usa o template da cautelar (mesmo papel timbrado)
TEMPLATE_PATH = os.path.join(
    SKILL_DIR, "..", "providencia-cautelar-administrativa", "assets", "template-cautelar.docx"
)


def escape_xml(text):
    """Escapa caracteres especiais XML."""
    return (str(text)
            .replace('&', '&amp;')
            .replace('<', '&lt;')
            .replace('>', '&gt;')
            .replace('"', '&quot;')
            .replace("'", '&apos;'))


def make_paragraph_empty(jc="both", spacing_line="360", bold=False, font="Arial"):
    """Gera um parágrafo vazio com formatação padrão."""
    rpr = ""
    if bold:
        rpr = f"""
        <w:rPr>
          <w:rFonts w:ascii="{font}" w:eastAsia="{font}" w:hAnsi="{font}" w:cs="{font}"/>
          <w:b/>
          <w:color w:val="000000"/>
        </w:rPr>"""
    return f"""
    <w:p>
      <w:pPr>
        <w:spacing w:line="{spacing_line}" w:lineRule="auto"/>
        <w:jc w:val="{jc}"/>{rpr}
      </w:pPr>
    </w:p>"""


def make_paragraph_text(text, jc="both", bold=False, underline=False, font="Arial",
                        spacing_line="360", indent_left=None, color="000000",
                        style=None):
    """Gera um parágrafo com texto."""
    ppr_parts = []
    if style:
        ppr_parts.append(f'<w:pStyle w:val="{style}"/>')
    ppr_parts.append(f'<w:spacing w:line="{spacing_line}" w:lineRule="auto"/>')
    if indent_left:
        ppr_parts.append(f'<w:ind w:left="{indent_left}"/>')
    ppr_parts.append(f'<w:jc w:val="{jc}"/>')

    rpr_parts = [f'<w:rFonts w:ascii="{font}" w:eastAsia="{font}" w:hAnsi="{font}" w:cs="{font}"/>']
    if bold:
        rpr_parts.append('<w:b/><w:bCs/>')
    if underline:
        rpr_parts.append('<w:u w:val="single"/>')
    if color:
        rpr_parts.append(f'<w:color w:val="{color}"/>')

    rpr = '\n          '.join(rpr_parts)
    ppr = '\n        '.join(ppr_parts)
    escaped = escape_xml(text)

    return f"""
    <w:p>
      <w:pPr>
        {ppr}
      </w:pPr>
      <w:r>
        <w:rPr>
          {rpr}
        </w:rPr>
        <w:t xml:space="preserve">{escaped}</w:t>
      </w:r>
    </w:p>"""


def make_section_title(title):
    """Gera título de secção (centrado, negrito, sublinhado)."""
    return (make_paragraph_empty(jc="center", bold=True) +
            make_paragraph_text(title, jc="center", bold=True, underline=True, spacing_line="360") +
            make_paragraph_empty(jc="center", bold=True))


def make_subsection_title(title):
    """Gera título de subsecção (centrado, negrito, sublinhado)."""
    return (make_paragraph_empty(jc="center") +
            make_paragraph_text(title, jc="center", bold=True, underline=True, spacing_line="360") +
            make_paragraph_empty(jc="center"))


def make_signature(advogado_nome, advogado_cp):
    """Gera bloco de assinatura."""
    return (make_paragraph_empty() +
            make_paragraph_text("O Advogado", jc="center", spacing_line="360") +
            make_paragraph_empty() +
            make_paragraph_text(advogado_nome, jc="center", bold=True, spacing_line="360") +
            make_paragraph_text(advogado_cp, jc="center", bold=True, spacing_line="360") +
            make_paragraph_empty() +
            make_paragraph_empty())


def build_requerimento_xml(data):
    """Constrói o XML do requerimento de interposição (primeira parte do documento)."""
    xml = []
    req = data.get("requerimento", {})

    # Cabeçalho: tribunal a quo
    xml.append(make_paragraph_text(
        "Exmo. Senhor", jc="left", bold=False, spacing_line="360"
    ))
    xml.append(make_paragraph_text(
        f"Juiz de Direito do {data['tribunal_a_quo']}", jc="left", bold=True, spacing_line="360"
    ))
    xml.append(make_paragraph_empty())
    xml.append(make_paragraph_text(
        f"Processo n.º {data['processo']}", jc="left", bold=False, spacing_line="360"
    ))

    for _ in range(3):
        xml.append(make_paragraph_empty())

    # Identificação e interposição
    recorrente = data["recorrente"]
    qualidade = recorrente.get("qualidade", "Requerente")
    xml.append(make_paragraph_text(
        f"{recorrente['nome']}, {qualidade} nos autos à margem referenciados, "
        f"notificado da decisão proferida nestes autos, vem interpor",
        jc="both", spacing_line="364"
    ))
    xml.append(make_paragraph_empty())
    xml.append(make_paragraph_text("RECURSO", jc="center", bold=True, spacing_line="360"))
    xml.append(make_paragraph_empty())
    xml.append(make_paragraph_text(
        "nos termos e com os fundamentos seguintes:", jc="both", spacing_line="364"
    ))
    xml.append(make_paragraph_empty())

    # Contextualização (razão do recurso — breve)
    if req.get("contextualizacao"):
        for para in req["contextualizacao"]:
            xml.append(make_paragraph_text(para, jc="both", spacing_line="364"))
            xml.append(make_paragraph_empty())

    # Classificação do recurso
    base_legal_recurso = req.get("base_legal_recurso", "")
    base_legal_tipo = req.get("base_legal_tipo", "")
    base_legal_subida = req.get("base_legal_subida", "")

    tipo_recurso = req.get("tipo_recurso", "ordinário de apelação")
    subida = req.get("subida", "nos próprios autos")

    xml.append(make_paragraph_text(
        f"recurso este que é {tipo_recurso} [{base_legal_tipo}],",
        jc="both", spacing_line="364"
    ))
    xml.append(make_paragraph_empty())
    xml.append(make_paragraph_text(
        f"com subida {subida} [{base_legal_subida}].",
        jc="both", spacing_line="364"
    ))
    xml.append(make_paragraph_empty())

    # Referência às alegações
    alegacoes_ref = req.get("alegacoes_referencia",
        "Em cumprimento do dever processual, seguem, junto, as alegações do recurso ora interposto.")
    xml.append(make_paragraph_text(alegacoes_ref, jc="both", spacing_line="364"))
    xml.append(make_paragraph_empty())

    # Efeito do recurso
    efeito = req.get("efeito", "devolutivo")
    fundamentacao_efeito = req.get("fundamentacao_efeito", [])

    if efeito == "suspensivo" and fundamentacao_efeito:
        xml.append(make_section_title("DO EFEITO A ATRIBUIR AO RECURSO"))
        xml.append(make_paragraph_text(
            "Requer-se que seja atribuído ao recurso efeito suspensivo",
            jc="both", bold=True, spacing_line="364"
        ))
        xml.append(make_paragraph_empty())
        for para in fundamentacao_efeito:
            xml.append(make_paragraph_text(para, jc="both", spacing_line="364"))
            xml.append(make_paragraph_empty())
    elif efeito == "suspensivo":
        xml.append(make_paragraph_text(
            "Requer-se que ao presente recurso seja atribuído efeito suspensivo.",
            jc="both", spacing_line="364"
        ))
        xml.append(make_paragraph_empty())

    # Pedido final do requerimento
    xml.append(make_paragraph_empty())
    xml.append(make_paragraph_text("TERMOS EM QUE", jc="both", bold=True, spacing_line="360"))
    xml.append(make_paragraph_text(
        f"se requer a V. Exa. o recebimento do presente recurso e a expedição do mesmo ao {data['tribunal_ad_quem']}.",
        jc="both", spacing_line="364"
    ))
    xml.append(make_paragraph_empty())
    xml.append(make_paragraph_empty())

    # Juntas
    juntas = req.get("juntas", "Alegações, D.U.C. e comprovativo do pagamento da taxa de justiça.")
    xml.append(make_paragraph_text(f"JUNTA: {juntas}", jc="both", spacing_line="360"))
    xml.append(make_paragraph_empty())

    # Assinatura do requerimento
    advogado_nome = data.get("advogado_nome", "Eduardo Dias")
    advogado_cp = data.get("advogado_cp", "CP 59368P OA")
    xml.append(make_signature(advogado_nome, advogado_cp))

    # Section break (nova página para as alegações)
    xml.append(f"""
    <w:p>
      <w:pPr>
        <w:sectPr>
          <w:headerReference w:type="default" r:id="rId7"/>
          <w:footerReference w:type="default" r:id="rId8"/>
          <w:pgSz w:w="11910" w:h="16840"/>
          <w:pgMar w:top="2360" w:right="1559" w:bottom="1600" w:left="1559" w:header="706" w:footer="1414" w:gutter="0"/>
          <w:pgNumType w:start="1"/>
          <w:cols w:space="720"/>
        </w:sectPr>
      </w:pPr>
    </w:p>""")

    return '\n'.join(xml)


def build_alegacoes_xml(data):
    """Constrói o XML das alegações e conclusões (segunda parte do documento)."""
    xml = []
    ale = data.get("alegacoes", {})

    # Cabeçalho das alegações — tribunal ad quem
    xml.append(make_paragraph_text("Venerandos", jc="left", bold=False, spacing_line="360"))
    xml.append(make_paragraph_text(
        f"Juízes Desembargadores do {data['tribunal_ad_quem']}",
        jc="left", bold=True, spacing_line="360"
    ))
    xml.append(make_paragraph_empty())
    xml.append(make_paragraph_text(
        data['tribunal_a_quo'], jc="left", bold=False, spacing_line="360"
    ))
    xml.append(make_paragraph_text(
        f"Processo n.º {data['processo']}", jc="left", bold=False, spacing_line="360"
    ))

    for _ in range(2):
        xml.append(make_paragraph_empty())

    # Identificação do recorrente nas alegações
    recorrente = data["recorrente"]
    qualidade = recorrente.get("qualidade", "Requerente")
    xml.append(make_paragraph_text(
        f"{recorrente['nome']}, {qualidade} e ora Recorrente nos autos à margem referenciados, "
        f"não se conformando com a decisão proferida nestes autos, apresenta, no âmbito do recurso "
        f"ora interposto, as Alegações infra para apreciação desse Egrégio Tribunal:",
        jc="both", spacing_line="364"
    ))
    xml.append(make_paragraph_empty())

    # OBJETO E DELIMITAÇÃO
    xml.append(make_section_title("OBJETO E DELIMITAÇÃO"))
    for para in ale.get("objeto_delimitacao", []):
        xml.append(make_paragraph_text(para, jc="both", spacing_line="364"))
        xml.append(make_paragraph_empty())

    # IMPUGNAÇÃO DA MATÉRIA DE FACTO (condicional)
    if ale.get("impugnacao_facto_ativa") and ale.get("impugnacao_facto"):
        xml.append(make_section_title("IMPUGNAÇÃO DA MATÉRIA DE FACTO"))
        for para in ale["impugnacao_facto"]:
            xml.append(make_paragraph_text(para, jc="both", spacing_line="364"))
            xml.append(make_paragraph_empty())

    # MATÉRIA DE DIREITO
    xml.append(make_section_title("MATÉRIA DE DIREITO"))

    for tese in ale.get("teses_direito", []):
        # Subtítulo da tese
        xml.append(make_subsection_title(tese["titulo"]))
        for para in tese.get("paragrafos", []):
            xml.append(make_paragraph_text(para, jc="both", spacing_line="364"))
            xml.append(make_paragraph_empty())

    # CONCLUSÕES
    xml.append(make_section_title("CONCLUSÕES"))
    for conclusao in ale.get("conclusoes", []):
        xml.append(make_paragraph_text(conclusao, jc="both", spacing_line="364"))
        xml.append(make_paragraph_empty())

    # PEDIDO FINAL
    xml.append(make_paragraph_empty())
    xml.append(make_paragraph_text("TERMOS EM QUE", jc="both", bold=True, spacing_line="360"))
    pedido_final = data.get("pedido_final",
        "e noutros que VV. Exas. suprirão, concedendo-se a apelação e revogando-se a decisão "
        "revidenda, substituindo-se por outra que decida em conformidade, far-se-á JUSTIÇA.")
    xml.append(make_paragraph_text(pedido_final, jc="both", spacing_line="364"))
    xml.append(make_paragraph_empty())
    xml.append(make_paragraph_text("Pede e Espera Deferimento,", jc="both", spacing_line="360"))
    xml.append(make_paragraph_empty())

    # Data
    if data.get("data"):
        xml.append(make_paragraph_text(data["data"], jc="both", spacing_line="360"))
    xml.append(make_paragraph_empty())

    # Assinatura
    advogado_nome = data.get("advogado_nome", "Eduardo Dias")
    advogado_cp = data.get("advogado_cp", "CP 59368P OA")
    xml.append(make_signature(advogado_nome, advogado_cp))

    return '\n'.join(xml)


def build_document_xml(data):
    """Constrói o document.xml completo."""
    header = """<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:cx="http://schemas.microsoft.com/office/drawing/2014/chartex" xmlns:cx1="http://schemas.microsoft.com/office/drawing/2015/9/8/chartex" xmlns:cx2="http://schemas.microsoft.com/office/drawing/2015/10/21/chartex" xmlns:cx3="http://schemas.microsoft.com/office/drawing/2016/5/9/chartex" xmlns:cx4="http://schemas.microsoft.com/office/drawing/2016/5/10/chartex" xmlns:cx5="http://schemas.microsoft.com/office/drawing/2016/5/11/chartex" xmlns:cx6="http://schemas.microsoft.com/office/drawing/2016/5/12/chartex" xmlns:cx7="http://schemas.microsoft.com/office/drawing/2016/5/13/chartex" xmlns:cx8="http://schemas.microsoft.com/office/drawing/2016/5/14/chartex" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:aink="http://schemas.microsoft.com/office/drawing/2016/ink" xmlns:am3d="http://schemas.microsoft.com/office/drawing/2017/model3d" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:oel="http://schemas.microsoft.com/office/2019/extlst" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w10="urn:schemas-microsoft-com:office:word" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml" xmlns:w16cex="http://schemas.microsoft.com/office/word/2018/wordml/cex" xmlns:w16cid="http://schemas.microsoft.com/office/word/2016/wordml/cid" xmlns:w16="http://schemas.microsoft.com/office/word/2018/wordml" xmlns:w16du="http://schemas.microsoft.com/office/word/2023/wordml/word16du" xmlns:w16sdtdh="http://schemas.microsoft.com/office/word/2020/wordml/sdtdatahash" xmlns:w16sdtfl="http://schemas.microsoft.com/office/word/2024/wordml/sdtformatlock" xmlns:w16se="http://schemas.microsoft.com/office/word/2015/wordml/symex" xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk" xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" mc:Ignorable="w14 w15 w16se w16cid w16 w16cex w16sdtdh w16sdtfl w16du wp14">
  <w:body>"""

    requerimento = build_requerimento_xml(data)
    alegacoes = build_alegacoes_xml(data)

    footer = """
    <w:sectPr>
      <w:headerReference w:type="default" r:id="rId10"/>
      <w:footerReference w:type="default" r:id="rId11"/>
      <w:pgSz w:w="11910" w:h="16840"/>
      <w:pgMar w:top="2360" w:right="1559" w:bottom="1660" w:left="1559" w:header="706" w:footer="1461" w:gutter="0"/>
      <w:cols w:space="720"/>
    </w:sectPr>
  </w:body>
</w:document>"""

    return header + requerimento + alegacoes + footer


def generate_docx(json_path, output_path, template_override=None):
    """Gera o .docx final a partir do template e dos dados JSON."""
    global TEMPLATE_PATH
    if template_override:
        TEMPLATE_PATH = template_override

    if not os.path.exists(TEMPLATE_PATH):
        alt = os.path.join(SCRIPT_DIR, "..", "assets", "template-cautelar.docx")
        if os.path.exists(alt):
            TEMPLATE_PATH = alt
        else:
            print(f"ERRO: Template não encontrado em {TEMPLATE_PATH}", file=sys.stderr)
            sys.exit(1)

    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    with tempfile.TemporaryDirectory() as tmpdir:
        extract_dir = os.path.join(tmpdir, 'template')
        with zipfile.ZipFile(TEMPLATE_PATH, 'r') as zf:
            zf.extractall(extract_dir)

        doc_xml = build_document_xml(data)
        doc_path = os.path.join(extract_dir, 'word', 'document.xml')
        with open(doc_path, 'w', encoding='utf-8') as f:
            f.write(doc_xml)

        with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as zf:
            for root, dirs, files in os.walk(extract_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, extract_dir)
                    zf.write(file_path, arcname)

    print(f"Recurso gerado com sucesso: {output_path}")


def main():
    parser = argparse.ArgumentParser(
        description='Gerar Recurso de Apelação em .docx'
    )
    parser.add_argument('--json', required=True, help='Ficheiro JSON com os dados do recurso')
    parser.add_argument('--output', required=True, help='Ficheiro .docx de saída')
    parser.add_argument('--template', help='Caminho alternativo para o template .docx')

    args = parser.parse_args()
    generate_docx(args.json, args.output, args.template)


if __name__ == '__main__':
    main()
