#!/usr/bin/env python3
"""
Gerador de Providência Cautelar Administrativa em .docx
Usa o template do escritório como base, preservando cabeçalhos, rodapés,
logótipo, fontes e toda a formatação do papel timbrado.

Uso:
    python gerar_docx.py --json dados.json --output cautelar.docx

O ficheiro JSON deve conter:
{
    "tribunal": "Tribunal Administrativo e Fiscal de ...",
    "juizo": "Exmo. Senhor Juiz de Direito do Juízo ...",
    "requerente": {
        "nome": "NOME COMPLETO EM MAIÚSCULAS",
        "descricao": "nacional de ..., portador do documento de identificação n.º ..., NIF ..., residente na ..."
    },
    "requerida": {
        "nome": "AGÊNCIA PARA A INTEGRAÇÃO, MIGRAÇÕES E ASILO, I.P.",
        "descricao": ", com sede na ..."
    },
    "tipo_acao": "PROVIDÊNCIA CAUTELAR",
    "subtipo_acao": "DE SUSPENSÃO DE EFICÁCIA DE ATO ADMINISTRATIVO",
    "factos": [
        "Texto integral do artigo 1.º",
        "Texto integral do artigo 2.º"
    ],
    "direito_inicio_artigo": 20,
    "direito": [
        "Texto integral do primeiro artigo da secção de direito"
    ],
    "pedidos_abertura": "Nestes termos e nos melhores de direito que V. Exa. doutamente suprirá, requer-se:",
    "pedidos": [
        "a) Seja decretada a suspensão de eficácia ...",
        "b) ..."
    ],
    "valor_causa": "€ 5.000,00 (cinco mil euros)",
    "prova": {
        "documental": "Os documentos juntos aos presentes autos, que se dão por integralmente reproduzidos."
    },
    "documentos": [
        "Doc. 1 - Cópia do ato impugnado",
        "Doc. 2 - Cópia do passaporte"
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
import xml.etree.ElementTree as ET

# Diretório deste script
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SKILL_DIR = os.path.dirname(SCRIPT_DIR)
TEMPLATE_PATH = os.path.join(SKILL_DIR, "assets", "template-cautelar.docx")

# Namespaces XML usados no .docx
NS = {
    'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    'wp': 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
    'w14': 'http://schemas.microsoft.com/office/word/2010/wordml',
}


def escape_xml(text):
    """Escapa caracteres especiais XML."""
    return (text
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
    return make_paragraph_text(text, jc="both", spacing_line="364", indent_left=None)


def make_section_title(title):
    """Gera título de secção (centrado, negrito, sublinhado)."""
    return (make_paragraph_empty(jc="center", bold=True) +
            make_paragraph_text(title, jc="center", bold=True, underline=True, spacing_line="360") +
            make_paragraph_empty(jc="center", bold=True))


def build_section1_xml(data):
    """Constrói o XML da primeira secção (cabeçalho com partes)."""
    xml_parts = []

    # Tribunal
    xml_parts.append(make_paragraph_text(
        data["tribunal"],
        jc="left", bold=True, font="Arial",
        spacing_line="360", indent_left="4320",
        style="Ttulo2"
    ))

    # Juízo
    xml_parts.append(make_paragraph_text(
        data["juizo"],
        jc="left", bold=True, font="Arial",
        spacing_line="360", indent_left="4320",
        style="Ttulo2"
    ))

    # Espaços em branco
    for _ in range(8):
        xml_parts.append(make_paragraph_empty(bold=True))

    # Requerente
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
        <w:t xml:space="preserve">{escape_xml(data["requerente"]["nome"])}, </w:t>
      </w:r>
      <w:r>
        <w:rPr>
          <w:rFonts w:ascii="Arial" w:eastAsia="Arial" w:hAnsi="Arial" w:cs="Arial"/>
          <w:color w:val="000000"/>
        </w:rPr>
        <w:t xml:space="preserve">{escape_xml(data["requerente"]["descricao"])}</w:t>
      </w:r>
    </w:p>""")

    # Espaço
    xml_parts.append(make_paragraph_empty())

    # "vem requerer,"
    xml_parts.append(make_paragraph_text("vem requerer,", jc="left", bold=True,
                                         indent_left="142", style="Ttulo2"))
    xml_parts.append(make_paragraph_empty(bold=True))

    # Tipo de ação
    xml_parts.append(make_paragraph_text(data["tipo_acao"], jc="center", bold=True,
                                         style="Ttulo1"))
    xml_parts.append(make_paragraph_empty(bold=True))

    # Subtipo
    xml_parts.append(make_paragraph_text(data["subtipo_acao"], jc="center",
                                         bold=True, underline=True))
    xml_parts.append(make_paragraph_empty(bold=True))

    # "contra,"
    xml_parts.append(make_paragraph_text("contra,", jc="left", bold=True,
                                         indent_left="140", style="Ttulo2"))
    xml_parts.append(make_paragraph_empty(bold=True))

    # Requerida
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
        <w:t xml:space="preserve">{escape_xml(data["requerida"]["nome"])}</w:t>
      </w:r>
      <w:r>
        <w:rPr>
          <w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>
        </w:rPr>
        <w:t xml:space="preserve">{escape_xml(data["requerida"]["descricao"])}</w:t>
      </w:r>
    </w:p>""")

    xml_parts.append(make_paragraph_empty())

    # "nos termos e com os fundamentos que seguem:" + sectPr da primeira secção
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
        <w:t xml:space="preserve">nos termos e com os fundamentos que seguem: </w:t>
      </w:r>
    </w:p>""")

    return '\n'.join(xml_parts)


def build_section2_xml(data):
    """Constrói o XML da segunda secção (corpo da providência cautelar)."""
    xml_parts = []

    xml_parts.append(make_paragraph_empty(jc="both"))

    # === DOS REQUISITOS DO ART. 114.º CPTA ===
    xml_parts.append(make_section_title("DOS REQUISITOS DO ART. 114.º DO CPTA"))

    requisitos = data.get("requisitos_114", {})

    if requisitos.get("providencia_adotada"):
        xml_parts.append(make_paragraph_text(
            "a)\tPROVIDÊNCIA QUE PRETENDE VER ADOTADA (art. 114.º, n.º 3, al. f) do CPTA):",
            jc="both", bold=True, spacing_line="364"
        ))
        xml_parts.append(make_paragraph_empty())
        xml_parts.append(make_paragraph_text(
            requisitos["providencia_adotada"], jc="both", spacing_line="364"
        ))
        xml_parts.append(make_paragraph_empty())

    if requisitos.get("acao_dependente"):
        xml_parts.append(make_paragraph_text(
            "b)\tAÇÃO DE QUE O PROCESSO DEPENDE OU IRÁ DEPENDER (art. 114.º, n.º 3, al. e) do CPTA):",
            jc="both", bold=True, spacing_line="364"
        ))
        xml_parts.append(make_paragraph_empty())
        xml_parts.append(make_paragraph_text(
            requisitos["acao_dependente"], jc="both", spacing_line="364"
        ))
        xml_parts.append(make_paragraph_empty())

    # === DOS FACTOS ===
    xml_parts.append(make_section_title("DOS FACTOS"))

    for i, facto in enumerate(data["factos"]):
        num = i + 1
        xml_parts.append(make_article_number(num))
        xml_parts.append(make_article_body(facto))
        xml_parts.append(make_paragraph_empty())

    # === DO DIREITO ===
    xml_parts.append(make_section_title("DO DIREITO"))

    inicio = data.get("direito_inicio_artigo", len(data["factos"]) + 1)
    for i, artigo in enumerate(data["direito"]):
        num = inicio + i
        xml_parts.append(make_article_number(num))
        xml_parts.append(make_article_body(artigo))
        xml_parts.append(make_paragraph_empty())

    # === DOS PEDIDOS ===
    xml_parts.append(make_section_title("DOS PEDIDOS"))

    xml_parts.append(make_paragraph_text(
        data["pedidos_abertura"], jc="both", spacing_line="364"
    ))
    xml_parts.append(make_paragraph_empty())

    for pedido in data["pedidos"]:
        xml_parts.append(make_paragraph_text(pedido, jc="both", spacing_line="364"))
        xml_parts.append(make_paragraph_empty())

    # === VALOR DA CAUSA ===
    xml_parts.append(make_paragraph_empty())
    xml_parts.append(make_paragraph_text(
        f"VALOR DA CAUSA: {data['valor_causa']}",
        jc="both", bold=True, spacing_line="360"
    ))

    # === PROVA ===
    xml_parts.append(make_paragraph_empty())
    xml_parts.append(make_paragraph_text("PROVA:", jc="both", bold=True, spacing_line="360"))
    xml_parts.append(make_paragraph_empty())

    prova = data.get("prova", {})

    # Prova testemunhal (opcional — incomum em cautelar mas possível)
    if prova.get("testemunhas"):
        xml_parts.append(make_paragraph_text(
            "A) PROVA TESTEMUNHAL:", jc="both", bold=True, spacing_line="360"
        ))
        xml_parts.append(make_paragraph_empty())
        for i, test in enumerate(prova["testemunhas"]):
            linha = (f"{i+1}. {test['nome']}, residente em {test['morada']}, "
                     f"a depor sobre a matéria dos artigos {test['factos']};")
            xml_parts.append(make_paragraph_text(linha, jc="both", spacing_line="364"))
        xml_parts.append(make_paragraph_empty())

    # Prova documental
    if prova.get("documental"):
        label = "B) PROVA DOCUMENTAL:" if prova.get("testemunhas") else "A) PROVA DOCUMENTAL:"
        xml_parts.append(make_paragraph_text(
            label, jc="both", bold=True, spacing_line="360"
        ))
        xml_parts.append(make_paragraph_empty())
        xml_parts.append(make_paragraph_text(prova["documental"], jc="both", spacing_line="364"))

    xml_parts.append(make_paragraph_empty())

    # === DOCUMENTOS ===
    if data.get("documentos"):
        xml_parts.append(make_paragraph_text(
            "JUNTA:", jc="both", bold=True, spacing_line="360"
        ))
        xml_parts.append(make_paragraph_empty())
        for doc in data["documentos"]:
            xml_parts.append(make_paragraph_text(doc, jc="both", spacing_line="364"))

    xml_parts.append(make_paragraph_empty())
    xml_parts.append(make_paragraph_empty())

    # === DECLARAÇÃO DE CONTRAINTERESSADOS (opcional) ===
    contrainteressados = data.get(
        "contrainteressados",
        "Declara-se não serem conhecidos contrainteressados no presente processo."
    )
    if contrainteressados:
        xml_parts.append(make_paragraph_text(
            contrainteressados, jc="both", spacing_line="360"
        ))
        xml_parts.append(make_paragraph_empty())

    # === DATA E LOCAL ===
    if data.get("data"):
        xml_parts.append(make_paragraph_text(data["data"], jc="both", spacing_line="360"))

    xml_parts.append(make_paragraph_empty())

    # === P. E. DEFERIMENTO (fórmula forense de praxe) ===
    xml_parts.append(make_paragraph_text(
        "P. E. Deferimento", jc="center", bold=True, spacing_line="360"
    ))
    xml_parts.append(make_paragraph_empty())

    # === QUALIFICAÇÃO "O Advogado" ===
    xml_parts.append(make_paragraph_text(
        "O Advogado", jc="center", bold=True, spacing_line="360"
    ))

    # === ASSINATURA ===
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


def generate_docx(json_path, output_path):
    """Gera o .docx final a partir do template e dos dados JSON."""
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

    print(f"Providência cautelar gerada com sucesso: {output_path}")


def main():
    parser = argparse.ArgumentParser(
        description='Gerar providência cautelar administrativa em .docx'
    )
    parser.add_argument('--json', required=True, help='Caminho para o ficheiro JSON com os dados')
    parser.add_argument('--output', required=True, help='Caminho para o ficheiro .docx de saída')
    parser.add_argument('--template', help='Caminho alternativo para o template .docx')

    args = parser.parse_args()

    if args.template:
        global TEMPLATE_PATH
        TEMPLATE_PATH = args.template

    generate_docx(args.json, args.output)


if __name__ == '__main__':
    main()
