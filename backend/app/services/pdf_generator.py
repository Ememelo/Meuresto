import io
import json
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from app.models.all_models import Employee

def generate_employee_ficha_pdf(emp: Employee) -> io.BytesIO:
    """
    Generates a professional PDF registration sheet (Ficha de Registro) for a collaborator.
    """
    buffer = io.BytesIO()
    
    # 0.75 inch margins (54 points)
    doc = SimpleDocTemplate(
        buffer, 
        pagesize=letter,
        rightMargin=54, 
        leftMargin=54, 
        topMargin=54, 
        bottomMargin=54
    )
    
    story = []
    styles = getSampleStyleSheet()
    
    # Define custom corporate styles (Navy Blue and Charcoal Text)
    PRIMARY_COLOR = colors.HexColor("#0f172a") # Dark Slate / Navy
    SECONDARY_COLOR = colors.HexColor("#d97706") # Gold
    TEXT_COLOR = colors.HexColor("#334155")
    
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=20,
        textColor=PRIMARY_COLOR,
        spaceAfter=4
    )
    
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=10,
        textColor=SECONDARY_COLOR,
        spaceAfter=15
    )
    
    section_style = ParagraphStyle(
        'SectionHeading',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=12,
        textColor=PRIMARY_COLOR,
        spaceBefore=10,
        spaceAfter=6
    )
    
    label_style = ParagraphStyle(
        'Label',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        textColor=PRIMARY_COLOR
    )
    
    value_style = ParagraphStyle(
        'Value',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        textColor=TEXT_COLOR
    )

    # 1. Header Title
    story.append(Paragraph("MEURESTÔ", title_style))
    story.append(Paragraph("Ficha de Registro de Colaborador", subtitle_style))
    story.append(Spacer(1, 10))
    
    # 2. Section: Dados Pessoais
    story.append(Paragraph("DADOS PESSOAIS", section_style))
    
    dob_str = emp.dob.strftime("%d/%m/%Y") if emp.dob else "N/A"
    
    personal_data = [
        [Paragraph("Matrícula:", label_style), Paragraph(emp.registration_number, value_style),
         Paragraph("Status:", label_style), Paragraph(emp.status.upper(), value_style)],
        [Paragraph("Nome Completo:", label_style), Paragraph(emp.name, value_style),
         Paragraph("CPF:", label_style), Paragraph(emp.cpf, value_style)],
        [Paragraph("RG:", label_style), Paragraph(emp.rg, value_style),
         Paragraph("Data Nasc.:", label_style), Paragraph(dob_str, value_style)],
        [Paragraph("Estado Civil:", label_style), Paragraph(emp.civil_status, value_style),
         Paragraph("Nacionalidade:", label_style), Paragraph(emp.nationality, value_style)],
        [Paragraph("E-mail:", label_style), Paragraph(emp.email, value_style),
         Paragraph("Telefone:", label_style), Paragraph(emp.phone, value_style)],
        [Paragraph("Nome da Mãe:", label_style), Paragraph(emp.mother_name, value_style),
         Paragraph("Nome do Pai:", label_style), Paragraph(emp.father_name or "Não Informado", value_style)],
        [Paragraph("Nº CTPS:", label_style), Paragraph(emp.ctps or "N/A", value_style),
         Paragraph("Nº PIS:", label_style), Paragraph(emp.pis or "N/A", value_style)],
        [Paragraph("Nº Reservista:", label_style), Paragraph(emp.reservista or "N/A", value_style),
         Paragraph("PCD:", label_style), Paragraph("Sim" if emp.has_disability else "Não", value_style)]
    ]
    
    t_personal = Table(personal_data, colWidths=[90, 160, 90, 164])
    t_personal.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('LINEBELOW', (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0")),
    ]))
    story.append(t_personal)
    story.append(Spacer(1, 15))
    
    # 3. Section: Endereço
    story.append(Paragraph("ENDEREÇO", section_style))
    
    address_data = [
        [Paragraph("CEP:", label_style), Paragraph(emp.address_cep, value_style),
         Paragraph("Logradouro:", label_style), Paragraph(emp.address_street, value_style)],
        [Paragraph("Número:", label_style), Paragraph(emp.address_number, value_style),
         Paragraph("Complemento:", label_style), Paragraph(emp.address_complement or "N/A", value_style)],
        [Paragraph("Bairro:", label_style), Paragraph(emp.address_neighborhood, value_style),
         Paragraph("Cidade/UF:", label_style), Paragraph(f"{emp.address_city} - {emp.address_state}", value_style)]
    ]
    
    t_address = Table(address_data, colWidths=[90, 160, 90, 164])
    t_address.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('LINEBELOW', (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0")),
    ]))
    story.append(t_address)
    story.append(Spacer(1, 15))
    
    # 4. Section: Contrato de Trabalho
    story.append(Paragraph("CONTRATO DE TRABALHO", section_style))
    
    adm_str = emp.contract.admission_date.strftime("%d/%m/%Y") if emp.contract and emp.contract.admission_date else "N/A"
    salary_str = f"R$ {emp.contract.base_salary:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".") if emp.contract else "N/A"
    role_str = emp.contract.role if emp.contract else "N/A"
    dept_str = emp.contract.department if emp.contract else "N/A"
    manager_str = emp.contract.manager_name if emp.contract else "N/A"
    
    # Parse benefits
    benefits_list = []
    if emp.contract and emp.contract.benefits:
        try:
            benefits_dict = json.loads(emp.contract.benefits)
            if isinstance(benefits_dict, dict):
                benefits_list = [
                    f"{k}: R$ {v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".") 
                    for k, v in benefits_dict.items() if v
                ]
            elif isinstance(benefits_dict, list):
                benefits_list = benefits_dict
        except Exception:
            benefits_list = [emp.contract.benefits]
            
    benefits_str = ", ".join(benefits_list) if benefits_list else "Nenhum benefício ativo"
    
    contract_data = [
        [Paragraph("Data Admissão:", label_style), Paragraph(adm_str, value_style),
         Paragraph("Salário Base:", label_style), Paragraph(salary_str, value_style)],
        [Paragraph("Cargo:", label_style), Paragraph(role_str, value_style),
         Paragraph("Departamento:", label_style), Paragraph(dept_str, value_style)],
        [Paragraph("Gestor Direto:", label_style), Paragraph(manager_str, value_style),
         Paragraph("Benefícios:", label_style), Paragraph(benefits_str, value_style)]
    ]
    
    t_contract = Table(contract_data, colWidths=[90, 160, 90, 164])
    t_contract.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('LINEBELOW', (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0")),
    ]))
    story.append(t_contract)
    story.append(Spacer(1, 15))
    
    # 5. Section: Dependentes (se existirem)
    if emp.dependents:
        story.append(Paragraph("DEPENDENTES", section_style))
        dep_rows = [[Paragraph("Nome", label_style), Paragraph("Grau de Parentesco", label_style), Paragraph("Data Nascimento", label_style)]]
        
        for dep in emp.dependents:
            dep_dob = dep.dob.strftime("%d/%m/%Y") if dep.dob else "N/A"
            dep_rows.append([
                Paragraph(dep.name, value_style),
                Paragraph(dep.relationship, value_style),
                Paragraph(dep_dob, value_style)
            ])
            
        t_dep = Table(dep_rows, colWidths=[200, 150, 154])
        t_dep.setStyle(TableStyle([
            ('ALIGN', (0,0), (-1,-1), 'LEFT'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#f8fafc")),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
        ]))
        story.append(t_dep)
        
    doc.build(story)
    buffer.seek(0)
    return buffer
