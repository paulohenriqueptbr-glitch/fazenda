from database.dados import usuarios
from utils.utils import titulo, clearCMD

def login():
	clearCMD()
	logado = False
	while not logado:
		titulo("FAZENDA SERTÃO")
		usuario = input("Digite seu usuário: ")
		senha = input("Digite sua senha: ")
	
		for user in usuarios:
			if user["usuario"] == usuario and user["senha"] == senha:
				admin = user["permissao"]
				logado = True
				print("Login realizado com sucesso!")
				break
		else:
			clearCMD()
			print("As credenciais informadas não existem.")
	return admin