from database.dados import animais, produtos, metricas, usuarios
from config.constantes import prefixos, tipos, animal_status

from utils.utils import menu_opcoes, gerar_id, titulo, exibir_animais, exibir_produtos, clearCMD


def cadastrar_animal ():
	clearCMD()
	titulo("CADASTRAR ANIMAL")
	
	tipo_escolhido = menu_opcoes("Tipo de Animal", tipos, False)
	identificacao = gerar_id(prefixos, animais, tipo_escolhido)
	status_escolhido = menu_opcoes("Status do Animal", animal_status, False)
	
	clearCMD()
	animais.append({"tipo": tipo_escolhido, "identificacao": identificacao, "status": status_escolhido})
	print(f"Animal '{identificacao}' cadastrado com sucesso!")

def buscar_animal ():
	clearCMD()
	titulo("BUSCAR ANIMAL")
	while True:
		identificacao = input("Informe a identificação do animal (brinco ou nº único) [ex: BOV-0001]: ")

		for animal in animais:
			if animal["identificacao"] == identificacao:
				exibir_animais([animal])
				break
		else:
			clearCMD()
			print("Nenhum animal com essa identificação foi encontrado.")

		nova_busca = input("Deseja realizar uma nova busca? (s/n): ").lower()

		if nova_busca != "s":
			clearCMD()
			break

def atualizar_animal():
	clearCMD()
	titulo("ATUALIZAR ANIMAL")

	while True:
		menu = ["Tipo", "Identificação", "Status"]
		campo = menu_opcoes("Qual informação deseja atualizar?", menu, True)

		if campo == 1:
			clearCMD()
			identificacao = input("Informe a identificação do animal (brinco ou nº único) [ex: BOV-0001]: ")

			for animal in animais:
				if animal["identificacao"] == identificacao:
					tipo_escolhido = menu_opcoes("Tipo de Animal", tipos, False)
					animal["tipo"] = tipo_escolhido
					clearCMD()
					print(f"Animal '{animal["identificacao"]}' atualizado com sucesso!")
					break
			else:
				clearCMD()
				print("Nenhum animal com essa identificação foi encontrado.")
		elif campo == 2:
			clearCMD()
			identificacao = input("Informe a identificação do animal (brinco ou nº único) [ex: BOV-0001]: ")

			for animal in animais:
				if animal["identificacao"] == identificacao:
					nova_identificacao = input("Informe a nova identificação do animal (brinco ou nº único) [ex: BOV-0001]: ")

					duplicado = True

					while duplicado:
						duplicado = False
						for animal in animais:
							if animal["identificacao"] == nova_identificacao:
								duplicado = True
								clearCMD()
								print(f"Identificação '{nova_identificacao}' já está em uso.")
								nova_identificacao = input("Informe a nova identificação do animal (brinco ou nº único) [ex: BOV-0001]: ")
								break
					
					clearCMD()
					animal["identificacao"] = nova_identificacao
					print(f"Animal '{animal["identificacao"]}' atualizado com sucesso!")
					break
			else:
				clearCMD()
				print("Nenhum animal com essa identificação foi encontrado.")
		elif campo == 3:
			clearCMD()
			identificacao = input("Informe a identificação do animal (brinco ou nº único) [ex: BOV-0001]: ")

			for animal in animais:
				if animal["identificacao"] == identificacao:
					status_escolhido = menu_opcoes("Status do Animal: ", animal_status, False)
					animal["status"] = status_escolhido
					clearCMD()
					print(f"Animal '{animal["identificacao"]}' atualizado com sucesso!")
					break
			else:
				clearCMD()
				print("Nenhum animal com essa identificação foi encontrado.")

		nova_alteracao = input("Deseja realizar uma nova alteração? (s/n): ").lower()

		if nova_alteracao != "s":
			clearCMD()
			break

def remover_animal():
	clearCMD()
	titulo("REMOVER ANIMAL")

	while True: 
		identificacao = input("Informe a identificação do animal (brinco ou nº único) [ex: BOV-0001]: ")

		for i in range(len(animais)):
			animal = animais[i]

			if animal["identificacao"] == identificacao:
					exibir_animais([animal])

					confirmar_remocao = input("Tem certeza que deseja remover este animal? (s/n): ").lower()

					if confirmar_remocao != "n":
						animais.pop(i)	
						clearCMD()
						print("Animal removido com sucesso!")
					break
		else:
			clearCMD()
			print("Nenhum animal com essa identificação foi encontrado.")
		
		nova_remocao = input("Deseja realizar uma nova remoção? (s/n): ").lower()

		if nova_remocao != "s":
			clearCMD()
			break

def listar_animais():
	clearCMD()
	if len(animais) == 0:
		print("Nenhum animal cadastrado.")
	else:
		titulo("LISTA DE ANIMAIS")
		exibir_animais(animais)

		print(f"Total de Animais: {len(animais)}")

def producao_leite():
	clearCMD()
	titulo("PRODUÇÃO DE LEITE")

	litros = float(input("Informe a produção diária em litros: "))

	while litros < 0:
		clearCMD()
		print("Valor inválido. Tente novamente")

		litros = float(input("Informe a produção diária em litros: "))

	meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]
	clearCMD()
	mes = menu_opcoes("Produção Diária", meses, True)

	metricas[mes - 1]["producao"] += litros
	clearCMD()
	print(f"Produção de {litros}L registrada com sucesso!")

def cadastrar_produto():
	clearCMD()
	titulo("CADASTRAR PRODUTO")

	while True:
		nome_produto = input("Nome do produto: ")

		while nome_produto == "":
			clearCMD()
			print("Nome inválido. Tente novamente")
			nome_produto = input("Nome do produto: ")

		nome_duplicado = True

		while nome_duplicado: 
			nome_duplicado = False
			for produto in produtos:
				if produto["nome"] == nome_produto:
					clearCMD()
					print("Já existe um produto com esse nome. Tente novamente.")
					nome_produto = input("Nome do produto: ")
					nome_duplicado = True
					break

		kg = float(input("Peso do produto: "))

		while kg <= 0:
			clearCMD()
			print("Peso inválido. Tente novamente")
			kg = float(input("Peso do produto: "))

		preco = float(input("Preço do produto: "))

		produtos.append({"nome": nome_produto, "peso": kg, "estoque": 0, "preco": preco})
		clearCMD()
		print(f"Produto '{nome_produto}' cadastrado com sucesso!")

		novo_produto = input("Deseja cadastrar um novo produto? (s/n): ").lower()

		if novo_produto != "s":
			clearCMD()
			break

def adicionar_estoque():
	clearCMD()
	titulo("ADICIONAR ESTOQUE")

	while True:
		lista_produtos = []

		for produto in produtos:
			lista_produtos.append(produto["nome"])

		index = menu_opcoes("Lista de Produtos", lista_produtos, True)

		quantidade = int(input(f"Quantidade a adicionar em estoque para '{produtos[index - 1]["nome"]}': "))

		while quantidade < 0:
			clearCMD()
			print("Valor inválido. Tente novamente.")
			quantidade = int(input(f"Quantidade a adicionar em estoque para '{produtos[index - 1]["nome"]}': "))

		produtos[index - 1]["estoque"] += quantidade
		clearCMD()
		print(f"Estoque de '{produtos[index - 1]["nome"]}' atualizado com sucesso!")

		novo_estoque = input("Deseja atualizar o estoque de outro produto? (s/n): ").lower()

		if novo_estoque != "s":
			clearCMD()
			break

def listar_produtos():
	clearCMD()
	if len(produtos) == 0:
		print("Nenhum produto cadastrado.")
	else:
		titulo("LISTA DE PRODUTOS")
		exibir_produtos(produtos)

		print(f"Total de Produtos: {len(produtos)}")

def grafico_producao():
	clearCMD()
	titulo("PRODUÇÃO MENSAL DE LEITE")

	maior_mes = 0

	for metrica in metricas:
		if metrica["producao"] > maior_mes:
			maior_mes = metrica["producao"]

	for metrica in metricas:
		valor = int(metrica["producao"] / 5)
		print(f"{metrica["mes"]} ┤ {'█' * valor:<{int(maior_mes / 5) + 1}} {metrica["producao"]}L")	

def cadastrar_usuario():
	clearCMD()
	titulo("CADASTRAR USUÁRIO")

	usuario = input("Digite o nome de usuário: ")

	duplicado = True
	
	while duplicado:
		duplicado = False
		for user in usuarios:
			if user["usuario"] == usuario:
				clearCMD()
				print("Já existe um usuário com esse nome. Tente novamente.")
				usuario = input("Digite o nome de usuário: ")
				duplicado = True
				break

	while len(usuario) < 4:
		clearCMD()
		print("Nome de usuário inválido. O usuário deve ter no mínimo 4 caracteres.")
		usuario = input("Digite o nome de usuário: ")
	
	senha = input("Digite a senha: ")

	while len(senha) < 4:
		clearCMD()
		print("Senha inválida. A senha deve ter no mínimo 4 caracteres.")
		senha = input("Digite a senha: ")
	
	permissao = input("Esse usuário terá permissão de administrador? (s/n): ").lower()

	if permissao == "s":
		permissao = True
	else:
		permissao = False

	usuarios.append({"usuario": usuario, "senha": senha, "permissao": permissao})
	clearCMD()
	print(f"Usuário '{usuario}' cadastrado com sucesso!")