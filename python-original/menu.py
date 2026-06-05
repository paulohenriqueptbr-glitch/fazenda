from rich.console import Console
from rich.panel import Panel
from rich.text import Text
from rich import box

from utils.utils import titulo, clearCMD
from fazenda.fazenda import cadastrar_animal, buscar_animal, atualizar_animal, remover_animal, listar_animais, producao_leite, cadastrar_produto, adicionar_estoque, listar_produtos, grafico_producao, cadastrar_usuario

console = Console()

menu_admin = Text()

menu_admin.append("\n  Animais\n \n", style="dim")
menu_admin.append("  1 - ", style="dim")
menu_admin.append("Cadastrar Animal\n", style="white")
menu_admin.append("  2 - ", style="dim")
menu_admin.append("Buscar Animal\n", style="white")
menu_admin.append("  3 - ", style="dim")
menu_admin.append("Atualizar Animal\n", style="white")
menu_admin.append("  4 - ", style="dim")
menu_admin.append("Remover Animal\n", style="white")
menu_admin.append("  5 - ", style="dim")
menu_admin.append("Listar Animais\n\n", style="white")

menu_admin.append("  Produção\n \n", style="dim")
menu_admin.append("  6 - ", style="dim")
menu_admin.append("Registrar Produção de Leite\n", style="white")
menu_admin.append("  7 - ", style="dim")
menu_admin.append("Gráfico de Produção de Leite\n\n", style="white")

menu_admin.append("  Estoque\n \n", style="dim")
menu_admin.append("  8 - ", style="dim")
menu_admin.append("Cadastrar Produto\n", style="white")
menu_admin.append("  9 - ", style="dim")
menu_admin.append("Adicionar Produto ao Estoque\n", style="white")
menu_admin.append("  10 - ", style="dim")
menu_admin.append("Ver Estoque Atual\n\n", style="white")

menu_admin.append("  Sistema\n \n", style="dim")
menu_admin.append("  11 - ", style="dim")
menu_admin.append("Cadastrar Usuário\n", style="white")

menu_admin.append("  12 - ", style="dim")
menu_admin.append("Sair\n", style="white")

menu_cliente = Text()

menu_cliente.append("\n  1 - ", style="dim")
menu_cliente.append("Ver Estoque Disponível\n", style="white")
menu_cliente.append("  2 - ", style="dim")
menu_cliente.append("Comprar Produto\n", style="white")
menu_cliente.append("  3 - ", style="dim")
menu_cliente.append("Comprar Animal\n", style="white")
menu_cliente.append("  4 - ", style="dim")
menu_cliente.append("Agendar Retirada\n", style="white")
menu_cliente.append("  5 - ", style="dim")
menu_cliente.append("Registrar Interesse em Produto\n", style="white")
menu_cliente.append("  6 - ", style="dim")
menu_cliente.append("Ver Meus Interesses\n", style="white")
menu_cliente.append("  7 - ", style="dim")
menu_cliente.append("Sair\n", style="white")


def menu(permissao):
	clearCMD()
	while True:
		if permissao:
			titulo("FAZENDA SERTÃO")
			console.print(
			    Panel(
			        menu_admin,
			        title="[bold white] MENU ADMINISTRADOR [/]",
			        border_style="dim",
			        box=box.ROUNDED,
			        width=42,
			        padding=(0, 1),
			    )
			)

			print("")

			op = int(input("Escolha uma opção: "))

			if op == 1:
				cadastrar_animal()
			elif op == 2:
				buscar_animal()
			elif op == 3:
				atualizar_animal()
			elif op == 4:
				remover_animal()
			elif op == 5:
				listar_animais()
			elif op == 6:
				producao_leite()
			elif op == 7:
				grafico_producao()
			elif op == 8:
				cadastrar_produto()
			elif op == 9:
				adicionar_estoque()
			elif op == 10:
				listar_produtos()
			elif op == 11:
				cadastrar_usuario()
			elif op == 12:
				clearCMD()
				print("Até logo! Obrigado por usar o sistema Fazenda Sertão.")
				break
			else:
				clearCMD()
				print("Opção inválida. Tente novamente.")
				continue
		else:
			titulo("FAZENDA SERTÃO")
			console.print(
			    Panel(
			        menu_cliente,
			        title="[bold white] MENU CLIENTE [/]",
			        border_style="dim",
			        box=box.ROUNDED,
			        width=42,
			        padding=(0, 1),
			    )
			)

			print("")

			op = int(input("Escolha uma opção: "))