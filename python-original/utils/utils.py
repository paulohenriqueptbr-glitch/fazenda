import os

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text
from rich import box

console = Console()

def exibir_animais(animais):
    tabela = Table(box=box.ROUNDED, border_style="dim", width=64)

    tabela.add_column("Tipo", style="dim")
    tabela.add_column("Identificação", style="dim")
    tabela.add_column("Status", style="dim")

    for animal in animais:
        tabela.add_row(animal["tipo"], animal["identificacao"], animal["status"])

    console.print(tabela)

def exibir_produtos(produtos):
    tabela = Table(box=box.ROUNDED, border_style="dim", width=64)

    tabela.add_column("Nome", style="dim")
    tabela.add_column("Peso", style="dim")
    tabela.add_column("Estoque", style="dim")
    tabela.add_column("Preço", style="dim")

    for produto in produtos:
        tabela.add_row(produto["nome"], f"KG {produto['peso']}", f"x{produto["estoque"]}", f"R$ {produto['preco']}")

    console.print(tabela)

def titulo(texto):
    console.print("─" * 42, style="dim", justify="center", width=42)
    console.print(f"  [bold white]{texto}[/]", justify="center", width=42)
    console.print("─" * 42, style="dim", justify="center", width=42)

def menu_opcoes(titulo, lista, posicao):
	while True:
		texto_menu = Text()
		for i in range(len(lista)):
			texto_menu.append(f"  {i + 1} - ", style="dim")
			if i == (len(lista) - 1):
				texto_menu.append(f"{lista[i]}", style="white")
			else:
				texto_menu.append(f"{lista[i]}\n", style="white")

		console.print(
            Panel(
                texto_menu,
                title=f"[bold white] {titulo}\n [/]",
                border_style="dim",
                box=box.ROUNDED,
                width=42,
                padding=(0, 1),
            )
        )
		
		index = int(input(f"Escolha (1-{len(lista)}): "))

		if index > 0 and index <= len(lista):
			break
		else:
			print("Opção inválida. Tente novamente.")

	if posicao:
		return index
	else:
		return lista[index - 1]

def gerar_id(lista_tipos, lista, tipo):

	if not tipo in lista_tipos:
		print("Não existe esse tipo de animal.")
		return
	
	prefixo = lista_tipos[tipo]
	i = 1

	while True:
		confirm = f"{prefixo}-{i:04d}"
		duplicado = False

		for animal in lista:
			if animal["identificacao"] == confirm:
				duplicado = True
				break

		if not duplicado:
			return confirm

		i += 1

def clearCMD():
  os.system('cls' if os.name == 'nt' else 'clear')