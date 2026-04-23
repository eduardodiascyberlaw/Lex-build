#!/usr/bin/env python3
"""
Gerador de Requerimento de Execução de Sentença Administrativa em .docx
Usa o template do escritório Eduardo Dias como base.

Utilização:
    python gerar_execucao.py --json dados_execucao.json --output execucao_final.docx
"""

import json
import os
import sys
import tempfile
import zipfile

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATE_PATH = os.path.join(SCRIPT_DIR, "..", "assets", "template-execucao.docx")


def escape_xml(text):
    return (str(text)
            .replace('&', '&amp;')
            .replace('<', '&lt;')
            .replace('>', '&gt;')
            .replace('"', '&quot;')
            .replace("'", '&apos;'))


def make_paragraph_empty(jc="both", spacing_line="360", bold=False):
    rpr = ""
    if bold:
        rpr = """
        <w:rPr>
          <w:rFonts w:ascii="Arial" w:eastAsia="Arial" w:hAnsi="Arial" w:cs="Arial"/>
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


def make_paragraph_text(text, jc="both", bold=False, underline=False,
                        spacing_line="360", indent_left=None, color="000000",
                        style=None, italic=False, font_size=None):
    ppr_parts = []
    if style:
        ppr_parts.append(f'<w:pStyle w:val="{style}"/>')
    ppr_parts.append(f'<w:spacing w:line="{spacing_line}" w:lineRule="auto"/>')
    if indent_left:
        ppr_parts.append(f'<w:ind w:left="{indent_left}"/>')
    ppr_parts.append(f'<w:jc w:val="{jc}"/>')

    rpr_parts = ['<w:rFonts w:ascii="Arial" w:eastAsia="Arial" w:hAnsi="Arial" w:cs="Arial"/>']
    if bold:
        rpr_parts.append('<w:b/><w:bCs/>')
    if italic:
        rpr_parts.append('<w:i/><w:iCs/>')
    if underline:
        rpr_parts.append('<w:u w:val="single"/>')
    if color:
        rpr_parts.append(f'<w:color w:val="{color}"/>')
    if font_size:
        rpr_parts.append(f'<w:sz w:val="{font_size}"/><w:szCs w:val="{font_size}"/>')

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
    """Título de secção centrado, negrito e sublinhado, com espaço antes e depois."""
    return (make_paragraph_empty(jc="center", bold=True) +
            make_paragraph_text(title, jc="center", bold=True, underline=True, spacing_line="360") +
            make_paragraph_empty(jc="center", bold=True))


def make_article_number(num):
    """Número do artigo centrado e em negrito."""
    return make_paragraph_text(f"{num}.º", jc="center", bold=True, spacing_line="360")


def make_article_body(text):
    """Corpo do artigo justificado."""
    return make_paragraph_text(text, jc="both", spacing_line="364")


def build_section1_xml(data):
    """Cabeçalho com tribunal, partes e tipo de requerimento."""
    xml_parts = []

    # Tribunal
    xml_parts.append(make_paragraph_text(
        data["tribunal"],
        jc="left", bold=True,
        spacing_line="360", indent_left="4320",
        style="Ttulo2"
    ))

    # Processo
    xml_parts.append(make_paragraph_text(
        f"Proc. n.º {data['processo']}",
        jc="left", bold=True,
        spacing_line="360", indent_left="4320",
        style="Ttulo2"
    ))

    # Espaços
    for _ in range(6):
        xml_parts.append(make_paragraph_empty(bold=True))

    # Exequente
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
        <w:t xml:space="preserve">{escape_xml(data["exequente"]["nome"])}</w:t>
      </w:r>
      <w:r>
        <w:rPr>
          <w:rFonts w:ascii="Arial" w:eastAsia="Arial" w:hAnsi="Arial" w:cs="Arial"/>
          <w:color w:val="000000"/>
        </w:rPr>
        <w:t xml:space="preserve">, {escape_xml(data["exequente"]["descricao"])}</w:t>
      </w:r>
    </w:p>""")

    xml_parts.append(make_paragraph_empty())

    # "vem requerer"
    xml_parts.append(make_paragraph_text(
        "vem, pelo seu mandatário, ao abrigo do disposto nos artigos 162.º, 166.º e 170.º do Código de Processo nos Tribunais Administrativos, requerer a",
        jc="both", indent_left="142", spacing_line="364"
    ))
    xml_parts.append(make_paragraph_empty(bold=True))

    # Tipo de requerimento
    xml_parts.append(make_paragraph_text(
        data["tipo_requerimento"],
        jc="center", bold=True, style="Ttulo1"
    ))
    xml_parts.append(make_paragraph_empty(bold=True))

    # "proferida nos presentes autos..."
    xml_parts.append(make_paragraph_text(
        "proferida nos presentes autos, o que faz nos termos e com os fundamentos seguintes:",
        jc="both", indent_left="142", spacing_line="364"
    ))

    # sectPr primeira secção
    xml_parts.append(f"""
    <w:p>
      <w:pPr>
        <w:jc w:val="both"/>
        <w:rPr>
          <w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>
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
    </w:p>""")

    return '\n'.join(xml_parts)


def build_section2_xml(data):
    """Corpo do requerimento de execução: secções I a IV, documentos e assinatura."""
    xml_parts = []
    xml_parts.append(make_paragraph_empty(jc="both"))

    artigo_num = 1

    # === SECÇÃO I — DA SENTENÇA EXEQUENDA ===
    xml_parts.append(make_section_title("I — DA SENTENÇA EXEQUENDA"))

    for art in data.get("sentenca_exequenda", []):
        xml_parts.append(make_article_number(artigo_num))
        xml_parts.append(make_article_body(art))
        xml_parts.append(make_paragraph_empty())
        artigo_num += 1

    # === SECÇÃO II — DO INCUMPRIMENTO ===
    xml_parts.append(make_section_title("II — DO INCUMPRIMENTO"))

    for art in data.get("incumprimento", []):
        xml_parts.append(make_article_number(artigo_num))
        xml_parts.append(make_article_body(art))
        xml_parts.append(make_paragraph_empty())
        artigo_num += 1

    # === SECÇÃO III — DO DIREITO ===
    xml_parts.append(make_section_title("III — DO DIREITO"))

    for art in data.get("direito", []):
        xml_parts.append(make_article_number(artigo_num))
        xml_parts.append(make_article_body(art))
        xml_parts.append(make_paragraph_empty())
        artigo_num += 1

    # === SECÇÃO IV — DO PEDIDO ===
    xml_parts.append(make_section_title("IV — DO PEDIDO"))

    xml_parts.append(make_paragraph_text(
        data.get("pedidos_abertura", "Termos em que requer a V. Exa. se digne:"),
        jc="both", spacing_line="364"
    ))
    xml_parts.append(make_paragraph_empty())

    for pedido in data.get("pedidos", []):
        xml_parts.append(make_paragraph_text(pedido, jc="both", spacing_line="364"))
        xml_parts.append(make_paragraph_empty())

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
        "O Advogado,", jc="center", spacing_line="360"
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

    return '\n'.join(xml_parts)


def build_document_xml(data):
    """Monta o XML completo do document.xml."""
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
    """Gera o ficheiro .docx a partir do JSON de dados e do template."""
    template = TEMPLATE_PATH
    if not os.path.exists(template):
        print(f"ERRO: Template não encontrado em {template}", file=sys.stderr)
        sys.exit(1)

    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    with tempfile.TemporaryDirectory() as tmpdir:
        extract_dir = os.path.join(tmpdir, 'template')
        with zipfile.ZipFile(template, 'r') as zf:
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

    print(f"Requerimento de execução gerado: {output_path}")


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(
        description="Gera requerimento de execução de sentença administrativa em .docx"
    )
    parser.add_argument('--json', required=True, help="Caminho para o ficheiro JSON com os dados")
    parser.add_argument('--output', required=True, help="Caminho para o ficheiro .docx de saída")
    args = parser.parse_args()
    generate_docx(args.json, args.output)
