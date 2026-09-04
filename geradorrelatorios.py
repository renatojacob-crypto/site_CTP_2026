import os
import sys
from datetime import datetime

# Tratamento inicial para alertar sobre módulos ausentes de forma clara
try:
    import pandas as pd
    from docx import Document
except ImportError as e:
    print(f"[Erro Crítico] Dependência não encontrada: {e}")
    print("Por favor, instale os módulos necessários antes de prosseguir.")
    sys.exit(1)

# ==========================================
# CONFIGURAÇÕES DE AMBIENTE
# ==========================================
EXCEL_FILE = r"D:\1-ZOOM\2026\8 - Escolas\CTP_Registros.xlsx"
ABA_PLANILHA = "CTPControlBD"
PASTA_RAIZ_DESTINO = r"D:\1-ZOOM\2026\8 - Escolas"

def formatar_valor_para_word(valor):
    """Garante que valores nulos ou de data sejam formatados corretamente para o Word."""
    if pd.isna(valor):
        return "Não informado"
    if isinstance(valor, datetime):
        return valor.strftime('%d/%m/%Y %H:%M:%S')
    return str(valor).strip()

def analisar_e_gerar_documentos():
    print("[Iniciando] Processo de geração de relatórios...")

    # 1. Validação de existência do arquivo
    if not os.path.exists(EXCEL_FILE):
        print(f"[Erro] O arquivo Excel não foi encontrado no caminho:\n{EXCEL_FILE}")
        return

    # 2. Carregamento dos dados
    try:
        df = pd.read_excel(EXCEL_FILE, sheet_name=ABA_PLANILHA)
    except Exception as e:
        print(f"[Erro] Falha ao ler o arquivo Excel. Verifique se está corrompido ou bloqueado. Detalhes: {e}")
        return

    colunas_obrigatorias = ['Monitoramento', 'Instituição', 'Data']
    for col in colunas_obrigatorias:
        if col not in df.columns:
            print(f"[Erro] Coluna obrigatória '{col}' ausente na aba '{ABA_PLANILHA}'.")
            return

    linhas_modificadas = 0

    # 3. Iteração e Processamento
    for index, row in df.iterrows():
        # Verifica se o monitoramento está pendente (vazio, nulo ou string vazia)
        valor_monitoramento = str(row['Monitoramento']).strip().lower()
        if pd.isna(row['Monitoramento']) or valor_monitoramento in ["", "nan", "none"]:
            
            instituicao = str(row['Instituição']).strip()
            data_atendimento = row['Data']
            
            # Sanitização da data para nome de pasta e arquivo
            if isinstance(data_atendimento, datetime):
                data_str_arquivo = data_atendimento.strftime('%Y-%m-%d')
                data_str_doc = data_atendimento.strftime('%d/%m/%Y')
            else:
                data_str_arquivo = str(data_atendimento).replace('/', '-').strip()
                data_str_doc = str(data_atendimento)

            # Prevenção contra nomes de diretórios inválidos no Windows
            instituicao_limpa = "".join(c for c in instituicao if c not in r'\/:*?"<>|')
            caminho_pasta = os.path.join(PASTA_RAIZ_DESTINO, instituicao_limpa, data_str_arquivo)
            
            try:
                os.makedirs(caminho_pasta, exist_ok=True)
                
                # Criação do documento Word
                doc = Document()
                doc.add_heading(f"Relatório de Atendimento: {instituicao}", level=1)
                doc.add_paragraph(f"Data do Atendimento: {data_str_doc}")
                doc.add_paragraph("-" * 50)
                doc.add_heading("Informações Registradas", level=2)
                
                # Inserção dinâmica dos campos
                for coluna in df.columns:
                    if coluna != 'Monitoramento':
                        valor_formatado = formatar_valor_para_word(row[coluna])
                        doc.add_paragraph(f"{coluna}: {valor_formatado}")
                
                # Salvamento do arquivo
                nome_documento = f"Documento_Atendimento_{data_str_arquivo}.docx"
                caminho_final_doc = os.path.join(caminho_pasta, nome_documento)
                doc.save(caminho_final_doc)
                
                print(f"[Sucesso] Documento gerado: {nome_documento} | Instituição: {instituicao_limpa}")
                
                # Atualiza estado em memória apenas se o documento foi salvo com sucesso
                df.at[index, 'Monitoramento'] = 'Sim'
                linhas_modificadas += 1

            except PermissionError:
                print(f"[Aviso] Sem permissão para gravar na pasta {caminho_pasta}. Pulando registro.")
            except Exception as e:
                print(f"[Erro] Falha ao processar a linha {index} (Instituição: {instituicao}). Detalhes: {e}")

    # 4. Atualização da planilha Excel
    if linhas_modificadas > 0:
        print(f"\n[Info] {linhas_modificadas} novo(s) documento(s) gerado(s). Atualizando banco de dados...")
        try:
            # Tenta reescrever a aba. O uso do 'openpyxl' é mandatório aqui.
            with pd.ExcelWriter(EXCEL_FILE, engine='openpyxl', mode='a', if_sheet_exists='replace') as writer:
                df.to_excel(writer, sheet_name=ABA_PLANILHA, index=False)
            print("[Concluído] Planilha base atualizada com sucesso na coluna 'Monitoramento'.")
        except PermissionError:
            print(f"\n[Erro Crítico] O arquivo Excel '{EXCEL_FILE}' está aberto ou bloqueado.")
            print("Feche o arquivo Excel e aguarde a sincronização da nuvem antes de rodar o script.")
        except ValueError as ve:
            # Fallback caso o arquivo tenha apenas 1 aba e o mode='a' falhe
            print(f"[Aviso] Tentando método de gravação alternativo. Detalhe: {ve}")
            df.to_excel(EXCEL_FILE, sheet_name=ABA_PLANILHA, index=False, engine='openpyxl')
            print("[Concluído] Planilha atualizada via método alternativo.")
        except Exception as e:
            print(f"\n[Erro Crítico] Falha desconhecida ao salvar o Excel: {e}")
    else:
        print("\n[Concluído] Nenhum novo registro pendente de monitoramento foi encontrado.")

if __name__ == "__main__":
    analisar_e_gerar_documentos()