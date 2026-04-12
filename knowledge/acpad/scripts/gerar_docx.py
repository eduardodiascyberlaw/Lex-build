#!/usr/bin/env python3
"""
Gerador de Ação de Condenação à Prática de Ato Devido (ACPAD) em .docx
Usa o template do escritório como base, preservando cabeçalhos, rodapés,
logótipo, fontes e toda a formatação do papel timbrado.

Uso:
    python gerar_docx.py --json dados.json --output acpad.docx

O ficheiro JSON deve conter:
{
    "tribunal": "Tribunal Administrativo e Fiscal de ...",
    "processo_cautelar": "n.º 432/26.4BELRA",     ← omitir se não houver cautelar
    "autor": {
        "nome": "NOME COMPLETO EM MAIÚSCULAS",
        "descricao": "nacional de ..., [profissão], portador/a do passaporte n.º ..., NIF ..., residente na ..."
    },
    "re": {
        "nome": "AGÊNCIA PARA A INTEGRAÇÃO, MIGRAÇÕES E ASILO, I.P.",
        "descricao": ", com sede na ..."
    },
    "tipo_acao": "AÇÃO DE CONDENAÇÃO À PRÁTICA DE ATO DEVIDO",
    "base_legal": "nos termos do disposto no art. 66.º, n.º 1 e 2, do CPTA",
    "pressupostos": [
        "Texto integral do artigo 1.º",
        "Texto integral do artigo 2.º",
        "Texto integral do artigo 3.º"
    ],
    "factos": [
        "Texto integral do artigo 4.º",
        "Texto integral do artigo 5.º"
    ],
    "tempestividade_ativa": true,
    "tempestividade": [
        "Texto integral do primeiro artigo da tempestividade"
    ],
    "direito_inicio_artigo": 31,
    "direito": [
        "Texto integral do primeiro artigo da secção de direito"
    ],
    "pedidos_abertura": "Termos em que requer a V. Exa. se digne julgar a presente ação procedente e provada e, em consequência:",
    "pedidos": [
        "a) Ser declarado nulo / anulado o ato ...",
        "b) Ser a Ré condenada a praticar o ato de ..."
    ],
    "prova_documental": "Os documentos juntos aos presentes autos, que se dão por integralmente reproduzidos.",
    "prova_testemunhal": [
        {"nome": "Nome Completo", "morada": "Rua X, n.º Y, Cidade", "facto": "O que prova"}
    ],
    "prova_pericial": null,
    "valor_causa": "30.000,01 euros (art. 34.º, n.º 2, do CPTA)",
    "documentos": [
        "Procuração forense",
        "Comprovativo de pedido de apoio judiciário",
        "Doc. 1 — Cópia do ato impugnado",
        "Doc. 2 — Cópia do passaporte"
    ],
    "data": "Lisboa, 04 de abril de 2026",
    "advogado_nome": "Eduardo S Dias",
    "advogado_cp": "CP 59368P OA"
}
"""

import json
import os
import shutil
import sys
import tempfile
import zipfile
import argparse
import re

# No default template — always requires --template from the Node.js wrapper
TEMPLATE_PATH = None


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


def make_article_number(num):
    """Gera o parágrafo do número do artigo (centrado, negrito)."""
    return make_paragraph_text(f"{num}.º", jc="center", bold=True, spacing_line="360")


def make_article_body(text):
    """Gera o parágrafo do corpo do artigo (justificado)."""
    return make_paragraph_text(text, jc="both", spacing_line="364")


def make_section_title(title):
    """Gera título de secção (centrado, negrito, sublinhado)."""
    return (make_paragraph_empty(jc="center", bold=True) +
            make_paragraph_text(title, jc="center", bold=True, underline=True, spacing_line="360") +
            make_paragraph_empty(jc="center", bold=True))


def make_subsection_title(title):
    """Gera título de subsecção dentro de uma secção (centrado, sublinhado)."""
    return (make_paragraph_empty(jc="center") +
            make_paragraph_text(title, jc="center", bold=True, underline=True, spacing_line="360") +
            make_paragraph_empty(jc="center"))


def build_section1_xml(data):
    """Constrói o XML da primeira secção (cabeçalho com partes)."""
    xml_parts = []

    # Tribunal
    tribunal_text = data["tribunal"]
    if data.get("processo_cautelar"):
        tribunal_text += f"\nem apenso a Prov. Cautelar {data['processo_cautelar']}"

    xml_parts.append(make_paragraph_text(
        data["tribunal"],
        jc="left", bold=True, font="Arial",
        spacing_line="360", indent_left="4320",
        style="Ttulo2"
    ))

    # Referência ao processo cautelar (linha separada)
    if data.get("processo_cautelar"):
        xml_parts.append(make_paragraph_text(
            f"em apenso a Prov. Cautelar {data['processo_cautelar']}",
            jc="left", bold=True, font="Arial",
            spacing_line="360", indent_left="4320",
            style="Ttulo2"
        ))

    # Espaços em branco
    for _ in range(8):
        xml_parts.append(make_paragraph_empty(bold=True))

    # Autor
    xml_parts.append(f"""
    <w:p>
      <w:pPr>
        <w:spacing w:line="364" w:lineRule="auto"/>
        <w:ind w:left="142" w:right="137"/>
        <w:jc w:val="both"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:rFonts w:ascii="Arial" w:eastAsia="Arial" w:hAnsi="Arial" w:cs="Arial"/>
          <w:b/><w:bCs/>
          <w:color w:val="000000"/>
        </w:rPr>
        <w:t xml:space="preserve">{escape_xml(data["autor"]["nome"])}, </w:t>
      </w:r>
      <w:r>
        <w:rPr>
          <w:rFonts w:ascii="Arial" w:eastAsia="Arial" w:hAnsi="Arial" w:cs="Arial"/>
          <w:color w:val="000000"/>
        </w:rPr>
        <w:t xml:space="preserve">{escape_xml(data["autor"]["descricao"])}</w:t>
      </w:r>
    </w:p>""")

    xml_parts.append(make_paragraph_empty())

    # "vem intentar"
    xml_parts.append(make_paragraph_text(
        "vem intentar", jc="left", bold=True, indent_left="142", style="Ttulo2"
    ))
    xml_parts.append(make_paragraph_empty(bold=True))

    # Tipo de ação
    xml_parts.append(make_paragraph_text(
        data["tipo_acao"], jc="center", bold=True, style="Ttulo1"
    ))
    xml_parts.append(make_paragraph_empty(bold=True))

    # "contra,"
    xml_parts.append(make_paragraph_text(
        "contra,", jc="left", bold=True, indent_left="140", style="Ttulo2"
    ))
    xml_parts.append(make_paragraph_empty(bold=True))

    # Ré
    xml_parts.append(f"""
    <w:p>
      <w:pPr>
        <w:spacing w:line="364" w:lineRule="auto"/>
        <w:ind w:left="142" w:right="137"/>
        <w:jc w:val="both"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:rFonts w:ascii="Arial" w:eastAsia="Arial" w:hAnsi="Arial" w:cs="Arial"/>
          <w:b/>
        </w:rPr>
        <w:t xml:space="preserve">{escape_xml(data["re"]["nome"])}</w:t>
      </w:r>
      <w:r>
        <w:rPr>
          <w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>
        </w:rPr>
        <w:t xml:space="preserve">{escape_xml(data["re"]["descricao"])}</w:t>
      </w:r>
    </w:p>""")

    xml_parts.append(make_paragraph_empty())

    # "o que faz nos termos ..." + sectPr primeira secção
    base_legal = data.get("base_legal", "nos termos do disposto no art. 66.º, n.º 1 e 2, do CPTA")
    xml_parts.append(f"""
    <w:p>
      <w:pPr>
        <w:ind w:left="142"/>
        <w:jc w:val="both"/>
        <w:rPr>
          <w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>
          <w:color w:val="000000"/>
        </w:rPr>
        <w:sectPr>
          <w:headerReference w:type="default" r:id="rId7"/>
          <w:footerReference w:type="default" r:id="rId8"/>
          <w:pgSz w:w="11910" w:h="16840"/>
          <w:pgMar w:top="2360" w:right="1559" w:bottom="1600" w:left="1559" w:header="706" w:footer="1414" w:gutter="0"/>
          <w:pgNumType w:start="1"/>
          <w:cols w:space="720"/>
        </w:sectPr>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>
          <w:color w:val="000000"/>
        </w:rPr>
        <w:t xml:space="preserve">o que faz {escape_xml(base_legal)}, e com os fundamentos seguintes:</w:t>
      </w:r>
    </w:p>""")

    return '\n'.join(xml_parts)


def build_section2_xml(data):
    """Constrói o XML da segunda secção (corpo da ACPAD)."""
    xml_parts = []
    xml_parts.append(make_paragraph_empty(jc="both"))

    # === SECÇÃO I — OBJETO DA AÇÃO E PRESSUPOSTOS ===
    xml_parts.append(make_section_title("I — OBJETO DA AÇÃO E PRESSUPOSTOS"))

    for i, art in enumerate(data.get("pressupostos", [])):
        num = i + 1
        xml_parts.append(make_article_number(num))
        xml_parts.append(make_article_body(art))
        xml_parts.append(make_paragraph_empty())

    # === SECÇÃO II — DOS FACTOS ===
    xml_parts.append(make_section_title("II — DOS FACTOS"))

    # Factos começam no artigo 4 (após os 3 de pressupostos)
    pressupostos_count = len(data.get("pressupostos", []))
    for i, facto in enumerate(data.get("factos", [])):
        num = pressupostos_count + 1 + i
        xml_parts.append(make_article_number(num))
        xml_parts.append(make_article_body(facto))
        xml_parts.append(make_paragraph_empty())

    # === SECÇÃO III — DA TEMPESTIVIDADE (condicional) ===
    if data.get("tempestividade_ativa") and data.get("tempestividade"):
        xml_parts.append(make_section_title("III — DA TEMPESTIVIDADE DA PRESENTE AÇÃO"))

        # Continuar numeração
        artigo_atual = pressupostos_count + len(data.get("factos", []))
        for i, art in enumerate(data["tempestividade"]):
            num = artigo_atual + 1 + i
            xml_parts.append(make_article_number(num))
            xml_parts.append(make_article_body(art))
            xml_parts.append(make_paragraph_empty())

        artigo_atual += len(data["tempestividade"])
    else:
        artigo_atual = pressupostos_count + len(data.get("factos", []))

    # === SECÇÃO IV — DO DIREITO ===
    xml_parts.append(make_section_title("IV — DO DIREITO"))

    inicio_direito = data.get("direito_inicio_artigo", artigo_atual + 1)
    for i, artigo in enumerate(data.get("direito", [])):
        num = inicio_direito + i
        xml_parts.append(make_article_number(num))
        xml_parts.append(make_article_body(artigo))
        xml_parts.append(make_paragraph_empty())

    # === SECÇÃO V — DO PEDIDO ===
    xml_parts.append(make_section_title("V — DO PEDIDO"))

    pedidos_abertura = data.get(
        "pedidos_abertura",
        "Termos em que requer a V. Exa. se digne julgar a presente ação procedente e provada e, em consequência:"
    )
    xml_parts.append(make_paragraph_text(pedidos_abertura, jc="both", spacing_line="364"))
    xml_parts.append(make_paragraph_empty())

    for pedido in data.get("pedidos", []):
        xml_parts.append(make_paragraph_text(pedido, jc="both", spacing_line="364"))
        xml_parts.append(make_paragraph_empty())

    # Citação da Ré
    xml_parts.append(make_paragraph_text(
        "Para tanto, requer-se a citação da Ré para contestar, querendo, seguindo-se os demais termos.",
        jc="both", spacing_line="364"
    ))
    xml_parts.append(make_paragraph_empty())

    # === PROVA ===
    xml_parts.append(make_paragraph_empty())
    xml_parts.append(make_paragraph_text("PROVA:", jc="both", bold=True, spacing_line="360"))
    xml_parts.append(make_paragraph_empty())

    has_test = bool(data.get("prova_testemunhal"))
    has_per = bool(data.get("prova_pericial"))
    label_idx = ord('A')

    # Prova testemunhal
    if has_test:
        label = f"{chr(label_idx)}) PROVA TESTEMUNHAL:"
        label_idx += 1
        xml_parts.append(make_paragraph_text(label, jc="both", bold=True, spacing_line="360"))
        xml_parts.append(make_paragraph_empty())
        for i, test in enumerate(data["prova_testemunhal"]):
            linha = (f"{i+1}. {test['nome']}, residente em {test['morada']}, "
                     f"a depor sobre {test['facto']};")
            xml_parts.append(make_paragraph_text(linha, jc="both", spacing_line="364"))
        xml_parts.append(make_paragraph_empty())

    # Prova pericial
    if has_per:
        label = f"{chr(label_idx)}) PROVA PERICIAL:"
        label_idx += 1
        xml_parts.append(make_paragraph_text(label, jc="both", bold=True, spacing_line="360"))
        xml_parts.append(make_paragraph_empty())
        xml_parts.append(make_paragraph_text(
            data["prova_pericial"], jc="both", spacing_line="364"
        ))
        xml_parts.append(make_paragraph_empty())

    # Prova documental
    if data.get("prova_documental"):
        label = f"{chr(label_idx)}) PROVA DOCUMENTAL:"
        xml_parts.append(make_paragraph_text(label, jc="both", bold=True, spacing_line="360"))
        xml_parts.append(make_paragraph_empty())
        xml_parts.append(make_paragraph_text(
            data["prova_documental"], jc="both", spacing_line="364"
        ))

    xml_parts.append(make_paragraph_empty())

    # === VALOR DA CAUSA ===
    xml_parts.append(make_paragraph_empty())
    valor = data.get("valor_causa", "30.000,01 euros (art. 34.º, n.º 2, do CPTA)")
    xml_parts.append(make_paragraph_text(
        f"Valor: {valor}", jc="both", bold=True, spacing_line="360"
    ))

    # === DOCUMENTOS ===
    xml_parts.append(make_paragraph_empty())
    if data.get("documentos"):
        xml_parts.append(make_paragraph_text(
            "Junta:", jc="both", bold=True, spacing_line="360"
        ))
        xml_parts.append(make_paragraph_empty())
        for doc in data["documentos"]:
            xml_parts.append(make_paragraph_text(doc, jc="both", spacing_line="364"))

    xml_parts.append(make_paragraph_empty())
    xml_parts.append(make_paragraph_empty())

    # === DATA ===
    if data.get("data"):
        xml_parts.append(make_paragraph_text(data["data"], jc="both", spacing_line="360"))

    xml_parts.append(make_paragraph_empty())
    xml_parts.append(make_paragraph_empty())

    # === ASSINATURA ===
    xml_parts.append(make_paragraph_text(
        "O Advogado", jc="center", bold=False, spacing_line="360"
    ))
    xml_parts.append(make_paragraph_empty())
    xml_parts.append(make_paragraph_text(
        data.get("advogado_nome", "Eduardo S Dias"),
        jc="center", bold=True, spacing_line="360"
    ))
    xml_parts.append(make_paragraph_text(
        data.get("advogado_cp", "CP 59368P OA"),
        jc="center", bold=True, spacing_line="360"
    ))

    xml_parts.append(make_paragraph_empty())
    xml_parts.append(make_paragraph_empty())

    return '\n'.join(xml_parts)


def build_document_xml(data):
    """Constrói o document.xml completo."""
    header = """<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:cx="http://schemas.microsoft.com/office/drawing/2014/chartex" xmlns:cx1="http://schemas.microsoft.com/office/drawing/2015/9/8/chartex" xmlns:cx2="http://schemas.microsoft.com/office/drawing/2015/10/21/chartex" xmlns:cx3="http://schemas.microsoft.com/office/drawing/2016/5/9/chartex" xmlns:cx4="http://schemas.microsoft.com/office/drawing/2016/5/10/chartex" xmlns:cx5="http://schemas.microsoft.com/office/drawing/2016/5/11/chartex" xmlns:cx6="http://schemas.microsoft.com/office/drawing/2016/5/12/chartex" xmlns:cx7="http://schemas.microsoft.com/office/drawing/2016/5/13/chartex" xmlns:cx8="http://schemas.microsoft.com/office/drawing/2016/5/14/chartex" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:aink="http://schemas.microsoft.com/office/drawing/2016/ink" xmlns:am3d="http://schemas.microsoft.com/office/drawing/2017/model3d" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:oel="http://schemas.microsoft.com/office/2019/extlst" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w10="urn:schemas-microsoft-com:office:word" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml" xmlns:w16cex="http://schemas.microsoft.com/office/word/2018/wordml/cex" xmlns:w16cid="http://schemas.microsoft.com/office/word/2016/wordml/cid" xmlns:w16="http://schemas.microsoft.com/office/word/2018/wordml" xmlns:w16du="http://schemas.microsoft.com/office/word/2023/wordml/word16du" xmlns:w16sdtdh="http://schemas.microsoft.com/office/word/2020/wordml/sdtdatahash" xmlns:w16sdtfl="http://schemas.microsoft.com/office/word/2024/wordml/sdtformatlock" xmlns:w16se="http://schemas.microsoft.com/office/word/2015/wordml/symex" xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk" xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" mc:Ignorable="w14 w15 w16se w16cid w16 w16cex w16sdtdh w16sdtfl w16du wp14">
  <w:body>"""

    section1 = build_section1_xml(data)
    section2 = build_section2_xml(data)

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

    return header + section1 + section2 + footer


def generate_docx(json_path, output_path, template_path=None):
    """Gera o .docx final a partir do template e dos dados JSON."""
    if not template_path:
        print("ERRO: --template é obrigatório", file=sys.stderr)
        sys.exit(1)

    if not os.path.exists(template_path):
        print(f"ERRO: Template não encontrado em {template_path}", file=sys.stderr)
        sys.exit(1)

    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    with tempfile.TemporaryDirectory() as tmpdir:
        extract_dir = os.path.join(tmpdir, 'template')
        with zipfile.ZipFile(template_path, 'r') as zf:
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

    print(f"ACPAD gerada com sucesso: {output_path}")


def main():
    parser = argparse.ArgumentParser(
        description='Gerar Ação de Condenação à Prática de Ato Devido em .docx'
    )
    parser.add_argument('--json', required=True, help='Ficheiro JSON com os dados da ação')
    parser.add_argument('--output', required=True, help='Ficheiro .docx de saída')
    parser.add_argument('--template', required=True, help='Caminho para o template .docx')

    args = parser.parse_args()
    generate_docx(args.json, args.output, args.template)


if __name__ == '__main__':
    main()
