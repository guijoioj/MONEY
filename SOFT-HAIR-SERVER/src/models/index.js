// Models do SoftHair Server
const BaseModel = require('./BaseModel');
const Usuario = require('./Usuario');
const Salao = require('./Salao');
const Cliente = require('./Cliente');
const Profissional = require('./Profissional');
const Servico = require('./Servico');
const Produto = require('./Produto');
const Venda = require('./Venda');
const Atendimento = require('./Atendimento');
const Agendamento = require('./Agendamento');
const Comissao = require('./Comissao');

module.exports = {
  BaseModel,
  Usuario,
  Salao,
  Cliente,
  Profissional,
  Servico,
  Produto,
  Venda,
  Atendimento,
  Agendamento,
  Comissao
};