# Murm — consolidação da nova arquitetura

Data: 18 de outubro de 2026. Estado: rascunho de arquitetura, não normativo.

Este documento explica a direção discutida para recomeçar o protocolo. A
reescrita correspondente agora está nas [MIPs](mips/README.md), todas em estado
`draft`. Elas substituem o desenho experimental anterior, sem prometer
compatibilidade com seus eventos e interfaces. Este texto continua sendo uma
visão explicativa, não uma segunda especificação normativa.

**Não é uma especificação pronta para implementar.** As decisões de arquitetura
estão registradas abaixo; os detalhes ainda não decididos aparecem como
pendências, sobretudo na seção 18. As escolhas adicionais feitas para dar
precisão aos rascunhos estão separadas na seção 19. O registro de kinds e as
regras concretas ficam nas MIPs; limites ilustrativos e pacotes cifrados de
exemplo não constituem um perfil completo. Campos como `<id>` e `<assinatura>` são marcadores
explicativos, não valores válidos para transmissão.

## 1. O que estamos construindo

Um protocolo descentralizado de eventos assinados. Ele deve permitir trocar de
aplicativo e de relay sem depender de uma empresa que controle a identidade ou
autorize o acesso à rede. Artigos, mensagens privadas e outras funcionalidades
usam a mesma base; cada MIP define os tipos e comportamentos de sua área.

Os termos usados aqui são:

| Termo | Significado |
| --- | --- |
| Cliente | Aplicativo usado pela pessoa para criar, assinar, ler e verificar eventos. |
| Relay | Serviço que recebe, guarda e entrega eventos. Pode também copiar eventos para outros relays. |
| Evento | Registro imutável, identificado por um hash e assinado por uma chave. |
| Chave pública | Identificador criptográfico com o qual se verifica uma assinatura. Não prova, sozinha, quem é uma pessoa. |
| Chave privada | Segredo usado para assinar ou, conforme o esquema escolhido, participar da criptografia. Não é enviado ao relay. |
| Kind | Número que identifica um tipo de evento definido por uma MIP. |
| MIP | Proposta que especifica uma parte do protocolo, incluindo os tipos que introduz. |
| Política do relay | Decisões locais de aceitação, limites, retenção, consultas e comunicação com outros relays. |

Não há login, senha de conta, sessão central ou servidor obrigatório de
identidade. Isso não obriga todos os relays a aceitar qualquer evento: cada
operador pode impor limites e recusar armazenamento.

Zero trust, aqui, significa não precisar acreditar no relay para verificar a
origem criptográfica e a integridade do evento. Não significa que uma assinatura
prove a verdade do conteúdo, a honestidade do autor ou que a busca está completa.

O objetivo é aumentar a resistência à censura e reduzir a dependência de qualquer
operador. Não existe promessa de funcionamento quando todos os caminhos estão
bloqueados ou todas as cópias desapareceram.

## 2. Caminho básico dos dados

O modelo é armazenamento intermediário, não conexão obrigatória entre os
computadores dos usuários.

1. Bruno cria e assina um evento no aplicativo.
2. O aplicativo envia o evento ao relay A.
3. A valida o evento e decide se aceita guardá-lo.
4. Se aceitar, confirma o armazenamento local e tenta propagá-lo conforme sua
   política, por exemplo para B e C.
5. Mais tarde, Ana consulta um relay que tenha uma cópia e verifica o evento no
   próprio aplicativo.

Bruno e Ana não precisam estar conectados ao mesmo tempo, hospedar um servidor
ou abrir uma porta de entrada no roteador. O relay pode rodar em um servidor ou
em um computador preparado para oferecer esse serviço; instalar o cliente não
transforma automaticamente o computador em relay.

Cada relay decide independentemente o que aceita. A confirmação de A não prova
que B recebeu, que Ana leu ou que haverá uma cópia disponível amanhã.

## 3. Envelope comum dos eventos

O envelope da versão 1 tem exatamente oito campos externos:

```json
{
  "version": 1,
  "id": "<hash do evento>",
  "signer": "<chave pública de assinatura>",
  "created_at": 1710000000,
  "kind": 1,
  "header": {},
  "content": "<valor JSON definido pela MIP>",
  "signature": "<assinatura>"
}
```

| Campo | Responsabilidade |
| --- | --- |
| `version` | Versão do envelope e das regras centrais. Não é a revisão de um artigo. |
| `id` | Hash calculado a partir dos dados assináveis do evento. |
| `signer` | Chave pública que permite verificar a assinatura. |
| `created_at` | Horário declarado pelo emissor, em segundos Unix. Não é um relógio confiável da rede. |
| `kind` | Tipo definido por uma MIP. |
| `header` | Objeto JSON de metadados públicos, cuja estrutura e significado pertencem à MIP do tipo. |
| `content` | Valor JSON definido pela MIP: não precisa ser sempre uma string. |
| `signature` | Assinatura criptográfica do identificador calculado. |

O `header` admite objetos e listas aninhados. Não há lista universal de tags
posicionais nem campos universais para anexos, destinatários, dispositivos,
autor lógico ou delegações. Uma MIP introduz o que seu tipo precisa, sem impor
isso aos demais eventos.

Todo o conteúdo de `header` e `content` participa da integridade do evento,
inclusive campos que uma implementação não conhece. Informações locais do
relay, como retenção, fila de propagação e marcadores de sincronização, ficam
fora do evento assinado.

Um evento publicado não muda. Uma edição produz outro evento e outra
assinatura; a MIP define como relacionar as versões.

### Evolução e tipos desconhecidos

- Campos externos adicionais são rejeitados na versão 1; não são ignorados.
- Um relay pode aceitar kinds desconhecidos como dados opacos, conforme sua
  política, depois de verificar o envelope, o hash e a assinatura.
- Guardar um kind desconhecido não equivale a validar sua semântica, indexar seus
  campos ou saber escolher sua versão atual.
- A MIP pode evoluir com informações opcionais compatíveis, desde que ignorá-las
  não mude o sentido nem a segurança do que o cliente antigo já interpreta.
- Mudanças incompatíveis na interpretação de um tipo recebem outro kind.
- Mudanças incompatíveis no envelope, na canonicalização ou na assinatura
  exigem evolução da versão central.

Não se deduz comportamento de faixas numéricas de kinds. A MIP-04 mantém a
reserva de rascunho `1` para publicações; os novos kinds de relays e mensagens
ainda aguardam definição. O registro preserva as reservas históricas sem
importar suas regras antigas para o núcleo.

## 4. Cálculo do ID e assinatura

O objeto usado para calcular o ID contém estes seis campos, sem `id` e sem
`signature`:

```json
{
  "version": 1,
  "signer": "<chave pública de assinatura>",
  "created_at": 1710000000,
  "kind": 1,
  "header": {},
  "content": "<valor JSON definido pela MIP>"
}
```

O procedimento acordado é:

1. Canonicalizar esse objeto com JCS, definido na
   [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785.html).
2. Codificar o resultado em UTF-8 e calcular SHA-256.
3. Representar o hash como 64 caracteres hexadecimais minúsculos no campo `id`.
4. Assinar os **32 bytes do hash**, não seu texto hexadecimal, usando Ed25519,
   definido na [RFC 8032](https://www.rfc-editor.org/rfc/rfc8032.html).

A verificação recalcula o hash, compara com `id` e verifica a assinatura.
A assinatura não é calculada sobre um segundo objeto que inclui o campo `id`.

Espaços de formatação e ordem das propriedades de um objeto não mudam o ID.
Conteúdo das strings e ordem dos elementos de uma lista fazem diferença.

As MIPs 01 e 02 agora propõem codificação hexadecimal minúscula para chaves e
assinaturas, limites de inteiros seguros e restrições de JSON compatíveis com
JCS. São escolhas concretas de rascunho registradas na seção 19; ainda exigem
verificação de interoperabilidade. Não foi acrescentado um prefixo de separação
de domínio ao cálculo.

## 5. Interface HTTP

| Operação | Método e caminho |
| --- | --- |
| Enviar um evento | `POST /events` |
| Buscar um evento local pelo ID | `GET /events/<id>` |
| Consultar eventos locais com filtros | `QUERY /events` |
| Alternativa compatível para consulta | `POST /events/query` |
| Acompanhar entradas no relay | `QUERY /events/sync` |
| Alternativa compatível para sincronização | `POST /events/sync` |
| Conhecer capacidades e políticas | `GET /info` |
| Obter contatos de relays | `GET /relays` |
| Pedir busca assistida de um ID, quando disponível | `GET /events/<id>?lookup=true` |

`QUERY` é o método de consulta com corpo definido na
[RFC 10008](https://www.rfc-editor.org/rfc/rfc10008.html). Os caminhos alternativos
com `POST` preservam a possibilidade de consulta quando a infraestrutura não
suporta `QUERY`; os detalhes da negociação ainda precisam ser especificados.

Não há necessidade de `PUT` para editar eventos imutáveis. Também não há
`/forward`, lista de destinos no envio ou relatório de encaminhamento para o
usuário. A discussão de RPC ficou adiada.

### Publicar e confirmar armazenamento

```http
POST /events
Content-Type: application/json

<evento completo e assinado>
```

Para um evento novo aceito e armazenado:

```http
HTTP/1.1 201 Created
Location: /events/<id>
Content-Type: application/json
```

```json
{
  "id": "<id>",
  "status": "stored",
  "retain_until": 1800000000
}
```

Para uma cópia válida de um evento que já está guardado:

```http
HTTP/1.1 200 OK
Content-Type: application/json
```

```json
{
  "id": "<id>",
  "status": "already_stored",
  "retain_until": 1800000000
}
```

Qualquer pessoa que possua o evento válido pode enviá-lo, não apenas o autor.
Receber uma duplicata não cria outro evento, não renova automaticamente a
retenção e não reinicia a propagação.

`retain_until` informa o prazo de retenção declarado pelo relay, em segundos
Unix. `null` significa ausência de um prazo mínimo prometido, não armazenamento
eterno. Essa declaração não torna um relay desonesto confiável.

Se o relay não consegue guardar o evento, deve recusar antes de confirmar
armazenamento. Uma falha posterior na propagação não desfaz a confirmação local.
As regras de renovação e as exceções ao compromisso de retenção ainda precisam
ser detalhadas.

## 6. Consultas e filtros

Exemplo de corpo para `QUERY /events` ou `POST /events/query`:

```json
{
  "filters": [
    {
      "kinds": [1],
      "signers": ["<chave de Ana>"],
      "since": 1710000000,
      "until": 1720000000,
      "header": [
        {"path": "/topics", "op": "contains", "value": "tecnologia"},
        {"path": "/language", "op": "eq", "value": "pt-BR"}
      ]
    }
  ],
  "limit": 20
}
```

Esse exemplo procura eventos do tipo indicado, assinados por Ana, no intervalo
declarado, com o tópico `tecnologia` e idioma `pt-BR`. Esses campos de cabeçalho
só são pesquisáveis se definidos pela MIP e suportados pelo relay.

Regras acordadas:

- Dentro de um objeto de filtro, todas as condições precisam ser satisfeitas
  (`AND`). Entre objetos de `filters`, basta satisfazer um deles (`OR`).
- Dentro de `kinds` ou `signers`, qualquer valor da lista pode corresponder.
- Um mesmo evento aparece uma única vez, mesmo que corresponda a vários filtros.
- `since` inclui o instante inicial; `until` exclui o instante final. Ambos
  comparam `created_at`, não o horário de chegada ao relay.
- `path` é um [JSON Pointer](https://www.rfc-editor.org/rfc/rfc6901.html) relativo
  a `header`. `/topics` significa o campo `topics` do cabeçalho.
- `eq` compara valores e tipos, sem conversão automática entre texto e número.
- `contains` procura um valor exato em uma lista, não um trecho de uma string.
- Campo ausente não corresponde à condição.
- Filtro ou operação não suportado gera erro explícito, não uma consulta mais
  ampla que ignora silenciosamente parte do pedido.

A ordenação padrão usa `created_at` decrescente. A MIP-03 agora propõe ID também
decrescente como desempate, uma das escolhas de rascunho da seção 19.

A resposta contém os eventos completos em `events` e um `next_cursor` para
continuar a consulta, ou `null` ao terminar. O cursor é um marcador opaco do
relay, vinculado à consulta: não é um ID de evento nem funciona em outro relay.

A MIP-03 propõe paginação comum sobre os dados disponíveis a cada página e,
para `current`, uma seleção fixada no início do percurso. Esses detalhes estão
explicados na MIP e precisam ser validados antes da aceitação. Paginação não
substitui sincronização contínua. A consulta pesquisa dados locais e campos
públicos; não pesquisa o texto de mensagens criptografadas.

### Visão atual de publicações

O corpo da consulta pode incluir `"view": "current"` para tipos em que o relay
implemente essa capacidade. Sem essa opção, a consulta devolve eventos
individuais, incluindo revisões históricas que correspondam aos filtros.

Na visão atual, a ordem conceitual é:

1. Agrupar as revisões pela identidade lógica definida na MIP.
2. Escolher a revisão válida preferida entre as conhecidas pelo relay.
3. Aplicar os filtros de resultado sobre essa revisão.

Não se filtra primeiro para depois escolher uma revisão antiga que sobrou.
Por exemplo, se a revisão 5 retira um artigo e a 4 o publica, filtrar por
`status = published` não pode fazer a revisão 4 reaparecer como atual. O mesmo
vale quando a revisão nova remove um tópico ou altera outro metadado.

Sem filtro que exclua retiradas, a visão atual devolve o próprio evento de
retirada quando ele é o preferido. Histórico e busca por ID continuam separados.

O relay anuncia em `/info` os kinds para os quais oferece essa visão. Um pedido
nesse modo envolvendo kind não suportado gera erro explícito; o cliente pode
montar a visão a partir dos eventos que recebeu.

"Atual" significa atual entre os eventos conhecidos, não a última versão
globalmente comprovada. Também falta definir como impedir regressão da visão
quando o relay elimina a revisão preferida, mas mantém revisões antigas.

## 7. Sincronização incremental

Sincronizar é acompanhar o que entrou no relay desde um marcador. Diferentemente
da busca ordenada por `created_at`, a sincronização acompanha a ordem local de
admissão dos eventos. Assim, também encontra um evento antigo que chegou hoje.

Exemplo de corpo para `QUERY /events/sync` ou `POST /events/sync`:

```json
{
  "filters": [{"kinds": [1], "signers": ["<chave de Ana>"]}],
  "cursor": null,
  "limit": 100
}
```

A resposta contém `events`, `cursor` e `has_more`:

- `cursor: null` no pedido inicia a leitura do histórico correspondente ainda
  disponível no relay.
- `has_more: true` indica que há mais dados para buscar naquele percurso.
- `has_more: false` indica que o cliente alcançou o fim naquele momento. Ele
  guarda o cursor retornado e consulta novamente depois.
- O cliente verifica e processa o lote, guardando os dados aceitos, antes de
  persistir o próximo cursor.

O cursor pertence à combinação de relay e filtros e não exige login. Se expirar,
o relay retorna explicitamente `cursor_expired`. O cliente reinicia a leitura do
histórico disponível e elimina duplicatas por ID; o relay não pula em silêncio
direto para o presente.

Uma duplicata de um evento ainda guardado não cria nova entrada. Se o evento
foi eliminado e depois foi aceito novamente, há uma nova admissão local.

Para acompanhar um artigo, o cliente precisa receber também edições e retiradas.
Os filtros de acompanhamento devem se apoiar em sua identidade estável, autor
e tipo, sem excluir retiradas nem depender apenas de tópicos ou status mutáveis.

O marcador não prova que o relay foi honesto ou entregou tudo. Dados já
eliminados não reaparecem apenas porque houve uma sincronização.

### Recuperação de relays após interrupções

Um relay também pode acompanhar outros relays pelos mesmos endpoints. Cada
origem e conjunto de filtros tem seu próprio cursor.

Ao voltar de uma interrupção, o relay retoma os lotes, valida os eventos e aplica
sua política local. Só avança o marcador depois de processar o lote e guardar o
que aceitou. Repetir um lote interrompido é tolerado pela deduplicação por ID.
Cursor expirado leva a uma nova leitura do histórico ainda retido.

A origem responde com seus dados locais, sem consultar uma cadeia de terceiros.
Eventos novos importados entram na propagação normal, com os mesmos limites;
duplicatas não abrem outra rodada.

Quem acompanhar, com quais filtros, em que frequência e com qual orçamento de
tráfego são escolhas locais. Esse processo em segundo plano não transforma uma
busca feita pelo usuário em uma pesquisa automática na rede inteira.

## 8. Propagação automática entre relays

Quando aceita e guarda um evento novo, o relay tenta enviá-lo a alguns pares
conhecidos conforme sua política. O usuário não precisa pedir encaminhamento
nem escolher os destinos dessa propagação.

O evento enviado é exatamente o original: mesmo ID, conteúdo e assinatura.
O destinatário verifica tudo e decide se aceita. Não existe número universal
acordado de cópias ou pares por evento.

Para limitar desperdício e circulação repetida:

- Receber uma duplicata já armazenada não inicia outra rodada.
- As tentativas têm intervalos crescentes e limites finitos.
- O trabalho total por evento é limitado, incluindo a troca de destinos.
- A fila tem limite de tamanho e de duração.
- Esgotar o orçamento encerra aquela tentativa de propagação; não desfaz o
  armazenamento local confirmado.
- O relay pode lembrar IDs vistos por algum tempo depois de eliminar o
  conteúdo, reduzindo recirculação. Essa lembrança não prova que ainda o guarda.

Seleção de pares, intervalos, orçamento e duração da memória de IDs são políticas
locais a detalhar. Não há garantia de propagação global, número mínimo de cópias
ou eliminação eterna de ciclos depois que todas as memórias expirarem.

## 9. Busca assistida por ID

Por padrão, `GET /events/<id>` só procura no relay consultado. Não encontrar ali
não significa que o evento não existe em nenhum lugar.

Um relay pode oferecer, conforme sua política:

```http
GET /events/<id>?lookup=true
```

Nesse caso, o pedido explícito permite procurar primeiro localmente e depois
em um conjunto limitado de pares conhecidos. Os pares consultados respondem
apenas com suas próprias cópias: não repetem o lookup em outros relays.

Essa capacidade:

- é anunciada em `/info`, junto com seus limites;
- vale para IDs exatos, não para filtros de pesquisa nem sincronização;
- gera erro explícito quando pedida e não oferecida;
- revela o ID procurado aos pares envolvidos;
- não oferece prova de inexistência global se ninguém consultado responder.

Ainda falta fechar como a resposta distingue ausência local, busca incompleta,
indisponibilidade de pares e término do orçamento.

## 10. Capacidades, limites e abuso

`GET /info` permite descobrir o que um relay oferece. Exemplo parcial de formato,
com limites ilustrativos:

```json
{
  "versions": [1],
  "validated_kinds": [1],
  "accept_unknown_kinds": true,
  "limits": {
    "event_bytes": 1048576,
    "query_results": 100
  },
  "header_filters": [
    {"kind": 1, "path": "/topics", "ops": ["contains"]}
  ]
}
```

O anúncio diferencia validação semântica de armazenamento opaco. Aceitar um
kind não implica oferecer todos os seus filtros ou a visão atual. Também deve
descrever retenção, lookup e capacidades de visão atual; o formato completo
desses anúncios ainda não está fechado.

Não há login, CAPTCHA, pagamento ou prova de trabalho obrigatórios no núcleo
inicial. A proteção inicial combina limites de tamanho, complexidade das
consultas, simultaneidade, processamento, armazenamento e tráfego.

Limites por origem não substituem limites agregados. Uma chave não equivale a
uma pessoa, porque criar novas chaves é barato. Um IP também não equivale a uma
pessoa, porque pode representar uma rede compartilhada ou VPN.

As recusas precisam distinguir:

| Situação | Significado para o cliente |
| --- | --- |
| Evento inválido | Reenviar o mesmo evento não corrige, por exemplo, uma assinatura inválida. |
| Recusa por política local | O evento pode ser válido e aceito em outro relay. |
| Sobrecarga ou limite temporário | O cliente deve reduzir tentativas e aguardar. |

Para excesso de requisições, usa-se `429`, com `Retry-After` quando houver uma
estimativa, conforme a [RFC 6585](https://www.rfc-editor.org/rfc/rfc6585.html#section-4).
O catálogo completo de erros e respostas ainda precisa ser definido.

O relay anuncia limites públicos estáveis, mas pode recusar por carga momentânea.
Não há lista central obrigatória de banimentos. Esses controles não garantem
proteção contra ataques que saturam a própria conexão de rede.

## 11. Descoberta e identidade dos relays

`GET /relays` entrega anúncios públicos assinados de relays. Uma MIP própria
definirá o kind, os endereços, a validade e as regras de atualização desses
anúncios; sua numeração ainda não foi atribuída.

A identidade criptográfica do relay é distinta de seu endereço. Uma mesma
identidade pode anunciar mais de um endereço, mas assinar um anúncio não prova
disponibilidade, honestidade ou posse de qualquer evento.

O cliente pode começar a partir de contatos salvos, uma lista inicial
substituível ou um contato importado por link, arquivo ou QR code. Importar um
contato significa obter a informação necessária para tentar falar com um
relay; não cria uma conexão se o endereço estiver inacessível.

Não há diretório central obrigatório nem exigência de DHT, uma rede distribuída
de descoberta. Um contato privado recebido manualmente não é automaticamente
publicado como anúncio para todos.

Consultar fontes diferentes reduz a dependência de uma só origem. Muitos relays
ou muitas chaves não provam operadores independentes: uma pessoa pode controlar
todos eles e oferecer uma visão isolada da rede.

Encontrar um relay também não significa encontrar o conteúdo desejado. Ainda
falta especificar a ligação verificável entre endpoint e identidade anunciada,
validade, atualização e proteção contra anúncios antigos reapresentados.

## 12. Conectividade e resistência a bloqueios

A conexão direta por HTTPS é permitida. Nela, o relay vê o IP de quem se conecta.
Quem quiser ocultar esse IP pode usar uma VPN ou proxy; o protocolo não exige uma
rede de anonimato, Tor ou conexão direta entre os usuários.

Se o aplicativo oferece uma opção de proxy, deve respeitá-la nos seus acessos,
inclusive descoberta e tentativas alternativas, sem mudar silenciosamente para
uma conexão direta. VPN e proxy não são garantia de anonimato nem de acesso sob
qualquer bloqueio.

A primeira camada de resiliência acordada para o cliente é:

1. Guardar contatos conhecidos, sem depender de um único servidor ao iniciar.
2. Tentar outros endereços anunciados pelo mesmo relay, com tentativas limitadas.
3. Poder tentar outros relays configurados quando um está indisponível.
4. Publicar o mesmo evento assinado, sem gerar outra identidade a cada tentativa.
5. Permitir importar novos contatos manualmente.
6. Sem caminho disponível, manter dados locais e envios pendentes, sem apresentar
   um envio pendente como armazenamento já confirmado por um relay.

Exemplo: o provedor de Bruno bloqueia A, mas não B. Bruno pode publicar em B,
e B pode ter um caminho até A que Bruno não tem. Isso depende das conexões e
políticas reais; não é um desvio garantido.

Para leitura, é preciso alcançar uma cópia ou um relay que possa buscá-la pelo
lookup explícito. Trocar de domínio mantendo o mesmo IP não resolve um bloqueio
desse IP. Uma falha de conexão tampouco prova que houve censura.

**A resistência forte a bloqueios ainda não está resolvida.** Endereços
alternativos e múltiplos relays ajudam, mas destinos HTTPS continuam bloqueáveis.
Falta escolher e avaliar mecanismos concretos contra identificação do protocolo,
sondagem ativa e bloqueios amplos. A [RFC 9505](https://www.rfc-editor.org/rfc/rfc9505.html)
é uma referência para separar esses diferentes tipos de ameaça.

## 13. Mensagens privadas

Mensagens privadas têm uma MIP própria. O cliente cifra antes de enviar; os
relays guardam e propagam o pacote cifrado. Um fragmento ilustrativo é:

```json
{
  "header": {"recipient": "<chave de identidade de Ana>"},
  "content": "<pacote criptografado>"
}
```

Isso não adiciona `recipient` ao envelope universal. O formato definitivo do
pacote pertence à MIP de mensagens.

Foi aceita, nesta etapa, a visibilidade pública das identidades criptográficas
do remetente e destinatário. Horários declarados e tamanho aproximado também
ficam observáveis. Cifrar o texto não esconde automaticamente quem fala com quem.

Ana anuncia, de maneira vinculada à sua identidade, suas chaves de criptografia
e os relays em que recebe mensagens. O aplicativo de Bruno tenta publicar em
pelo menos um desses relays, usando o envio normal; não depende somente de uma
propagação aleatória chegar até ela.

Bruno precisa saber qual identidade pertence à Ana pretendida. Uma assinatura
válida de uma chave desconhecida não resolve essa identificação social.

### Proteção das mensagens antigas

A direção escolhida usa sessões com chaves que evoluem e descarte das chaves
antigas quando não são mais necessárias. O objetivo é reduzir o que um roubo
posterior de segredos consegue revelar de mensagens anteriores.

O [Double Ratchet](https://signal.org/docs/specifications/doubleratchet/) é uma
referência para esse mecanismo, não um perfil completo já adotado. Apenas cifrar
cada mensagem para uma chave permanente, por exemplo com HPKE, não oferece a
mesma proteção contra comprometimento posterior do destinatário; essa limitação
é discutida na [RFC 9180](https://www.rfc-editor.org/rfc/rfc9180.html#section-9.7.4).

Essa proteção depende de eliminar os segredos relevantes. Ela não protege o
texto já salvo no histórico, backups descriptografáveis ou um dispositivo
comprometido enquanto a conversa acontece.

### Começar uma conversa com Ana offline

1. Antes de sair, Ana publica material público de inicialização, assinado e com
   validade. As partes privadas ficam com ela.
2. Bruno verifica o vínculo com a identidade de Ana e a validade do anúncio.
3. Ele cria a primeira mensagem cifrada, identificando o material utilizado,
   e a publica em um relay que Ana acompanha.
4. Ana volta, obtém a mensagem e usa seus segredos correspondentes para iniciar
   a sessão. As mensagens seguintes avançam as chaves da conversa.

A direção inicial usa pré-chaves assinadas reutilizáveis e renovadas
periodicamente. "Pré-chave" é material publicado antes da conversa para permitir
esse início assíncrono. Não se presume que vários relays consigam garantir o
consumo global de uma chave de uso único.

Há uma limitação aceita: enquanto os segredos de inicialização necessários
forem mantidos, seu comprometimento pode expor mensagens iniciais. A proteção
dessas mensagens depende também de descartar esses segredos, não só as chaves
individuais de mensagem. O [X3DH](https://signal.org/docs/specifications/x3dh/)
é uma referência para entender essa composição e suas limitações; não implica
usar os servidores do Signal.

Manter segredos antigos por algum tempo ajuda a receber mensagens atrasadas,
mas prolonga essa exposição. Os prazos, algoritmos, vínculos autenticados e
formato interoperável ainda precisam ser definidos antes da implementação.

## 14. Backup e troca de aplicativo

Recuperar a identidade e recuperar o histórico privado são operações distintas.
Importar a chave de identidade não recria chaves de mensagens que foram apagadas.

| O que a pessoa ainda possui | Possibilidade de recuperação |
| --- | --- |
| Dispositivo antigo acessível | Pode transferir o histórico por um procedimento protegido. |
| Backup e segredo para abri-lo | Pode recuperar o histórico incluído naquele backup. |
| Somente a identidade | Não recupera automaticamente o histórico cifrado com segredos descartados. |
| Apenas cópias cifradas nos relays | Não recupera mensagens sem os segredos necessários. |

O backup é opcional, cifrado e protegido por um segredo de recuperação separado
da chave de identidade. O ponto de partida é um arquivo sob controle do usuário,
sem nuvem ou conta obrigatórias. Possuir esse arquivo e seu segredo expõe o
histórico que ele contém.

A restauração recupera histórico e estabelece novas sessões. Não se deve
clonar um estado antigo de sessão ativa e usá-lo simultaneamente em dois
dispositivos. O formato de backup, sua criptografia e o procedimento de
transferência ainda precisam de especificação.

A portabilidade terá uma MIP própria: formatos documentados de exportação,
importação e recuperação, incluindo backup privado entre aplicativos que
suportem as mesmas capacidades. Não há token de API central nem aprovação de
uma empresa para desenvolver outro cliente compatível.

Trocar de aplicativo não exige trocar de identidade. Eventos públicos podem
ser buscados onde ainda existirem cópias; histórico privado depende de backup
ou transferência. Isso não torna aplicativos maliciosos confiáveis: eles podem
roubar segredos acessíveis ou impedir uma exportação. Cópias de recuperação
precisam existir antes da perda de acesso.

## 15. Artigos, revisões e retirada

A MIP de publicações define a identidade estável de um artigo e suas revisões.
Um cabeçalho ilustrativo é:

```json
{
  "publication": "artigo-123",
  "revision": 3,
  "status": "published"
}
```

A identidade lógica combina **autor, kind e identificador da publicação**.
Nos exemplos simples, o autor é identificado pelo `signer`. A relação entre
autor lógico, chaves de dispositivo e rotação de identidade continua pendente;
não se reaproveita implicitamente a delegação do desenho anterior.

Cada revisão é um evento completo e imutável, com o artigo inteiro, não apenas
as diferenças em relação ao anterior. Publicar e editar usam `POST /events`.
Não é preciso ter recebido todas as versões anteriores para verificar uma
revisão completa.

Um link estável aponta para a publicação; uma referência a uma edição exata
usa o ID do evento. O formato desses links e o formato do artigo, como Markdown
ou outra representação, ainda precisam ser definidos.

### Escolha entre revisões

- A numeração começa em 1. O aplicativo edita usando a maior revisão conhecida
  mais 1.
- Entre revisões válidas da mesma publicação e autor, prefere-se o maior número.
- Se houver empate, o maior ID hexadecimal de evento vence o desempate para a
  apresentação padrão.
- Esse desempate é determinístico; não prova qual edição ocorreu depois e não
  mescla o conteúdo.
- Edições concorrentes com o mesmo número podem ser válidas. Quando conhece o
  conflito, o aplicativo alerta o autor, que pode consolidá-las em outra revisão.

Clientes com o mesmo conjunto de eventos válidos chegam à mesma preferência.
Um relay pode esconder uma revisão nova, então isso não garante conhecer a
última revisão existente na rede.

Pesquisar uma revisão pelo número pode devolver mais de um evento concorrente.
Buscar pelo ID identifica uma versão sem essa ambiguidade.

### Retirar e restaurar uma publicação

Retirada é uma nova revisão assinada do mesmo tipo, não uma alteração física
dos eventos antigos. Fragmento de um evento de retirada:

```json
{
  "header": {
    "publication": "artigo-123",
    "revision": 5,
    "status": "withdrawn"
  },
  "content": null
}
```

Não precisa repetir o texto retirado. Quando essa é a revisão preferida, o
aplicativo deixa de apresentar o artigo como publicação ativa. Uma revisão
inferior não deve fazê-lo reaparecer. Uma assinatura de outro autor não permite
retirar a publicação de Ana.

Uma revisão superior, por exemplo 6, pode restaurar a publicação com status de
publicada e conteúdo completo. Retirada é, portanto, reversível.

O autor não consegue garantir o apagamento de todas as cópias. Revisões antigas
continuam com suas assinaturas válidas e podem ser pesquisadas ou buscadas pelo
ID se o relay as tiver mantido e as servir. A retenção física do relay é uma
decisão separada do estado editorial da publicação.

## 16. Exemplos combinando as decisões

### Artigo editado enquanto um leitor está offline

Ana publica a revisão 1 em A. A a propaga para B. Depois, Ana publica a revisão
2; B só a recebe no dia seguinte. Bruno volta e sincroniza B pelo marcador de
chegada local, encontrando a revisão 2 mesmo que seu `created_at` seja anterior
ao último horário em que ele abriu o aplicativo.

Ele verifica a assinatura e atualiza sua visão do artigo. Se precisar citar
exatamente a revisão 1, usa o ID daquela versão, que permanece recuperável onde
houver uma cópia servida.

### Artigo retirado, mas histórico mantido

B conhece as revisões 4, publicada, e 5, retirada. Uma consulta comum pode
encontrar ambas. Uma consulta com `view: current` considera a revisão 5.
Se também exigir status de publicada, não recebe esse artigo — não recebe a 4
como substituta. Uma busca direta pelo ID da revisão 4 ainda pode encontrá-la.

### Mensagem para alguém offline

Ana anuncia seu material público de inicialização e que recebe mensagens em B.
Bruno verifica a identidade, cifra localmente e envia o evento para B. B guarda
o pacote sem ler o texto. Ana o busca depois e o decifra localmente.

Uma confirmação de B significa armazenamento local, não leitura nem entrega
garantida. B e observadores dos eventos ainda podem ver as identidades públicas
envolvidas. A sessão criptográfica precisa seguir o futuro perfil da MIP; este
exemplo não define seus algoritmos ou formato final.

### Relay temporariamente fora do ar

C acompanha B, fica indisponível e volta. Retoma a sincronização com seu cursor,
valida e aceita eventos segundo sua política. Se o cursor expirou, relê o
histórico retido. Eventos já presentes não reiniciam a propagação; novos eventos
podem entrar em uma rodada limitada. O que B já eliminou não é recuperado por
esse procedimento.

## 17. Organização das MIPs no repositório

A reescrita foi distribuída desta forma, mantendo a documentação técnica em
inglês e esta explicação em português:

| MIP | Responsabilidade |
| --- | --- |
| [MIP-00](mips/MIP-00.md) | Processo, alocação de kinds e evolução. |
| [MIP-01](mips/MIP-01.md) | Envelope comum e validação estrutural. |
| [MIP-02](mips/MIP-02.md) | Canonicalização, ID e assinatura. |
| [MIP-03](mips/MIP-03.md) | Publicação, consultas, sincronização e capacidades HTTP. |
| [MIP-04](mips/MIP-04.md) | Publicações, revisões, conflitos e retirada. |
| [MIP-05](mips/MIP-05.md) | Compatibilidade, limites de confiança e pendências. |
| [MIP-06](mips/MIP-06.md) | Descoberta de relays, propagação, recuperação e lookup. |
| [MIP-07](mips/MIP-07.md) | Arquitetura e requisitos de mensagens privadas. |
| [MIP-08](mips/MIP-08.md) | Portabilidade e backup cifrado. |
| [MIP-09](mips/MIP-09.md) | Conectividade, privacidade e resistência a bloqueios. |

Todas permanecem como rascunhos. Os kinds antigos de perfil, comentário e reação
ficam reservados no histórico do registro, sem se tornarem requisitos do novo
núcleo. Reintroduzir essas funções exige especificações revisadas.

Identidade, dispositivos e transportes adicionais podem exigir MIPs próprias
depois de decididos. Nenhum modelo de chave principal e chaves de dispositivo
foi adotado implicitamente nesta reescrita.

## 18. Pendências antes de aceitar as especificações

### Identidade e controle das chaves

- Perda, roubo e recuperação da identidade: o que pode ser recuperado e por qual
  autoridade criptográfica, sem inventar um reset central.
- Rotação ou revogação, caso sejam adotadas, e como afetam a autoria de
  publicações já existentes.
- Chave de identidade versus chaves de dispositivos; uso simultâneo em vários
  dispositivos e vínculo entre autor lógico e `signer`.
- Como lidar com conflitos de autoridade sem tratar horários declarados por um
  invasor como prova confiável de que um evento precedeu a revogação.

### Criptografia completa das mensagens e dos backups

- Algoritmos e codificação do material específico de mensagens, além da composição
  entre inicialização e evolução das sessões. A assinatura externa do evento já
  está descrita na MIP-02.
- Vínculo criptográfico com identidade, destinatário e contexto externo do
  evento; formato exato do pacote.
- Validade das pré-chaves, prazo para receber mensagens atrasadas e descarte dos
  segredos de inicialização.
- Repetição de mensagens, chegada fora de ordem, limites de chaves pendentes,
  persistência segura do estado, recuperação de falhas e novas sessões.
- Regras para múltiplos dispositivos e reintrodução de dispositivos restaurados.
- Formato de backup, criptografia, derivação do segredo de proteção e transferência.

### Resistência a bloqueios

- Ameaças concretas que a primeira versão pretende enfrentar: DNS, IP,
  identificação de tráfego ou sondagem ativa não são o mesmo problema.
- Transportes e mecanismos efetivos além de HTTPS e endereços alternativos,
  com avaliação de custos, limitações e comportamento sob bloqueio.
- Diversidade real de descoberta e acesso, sem pressupor que muitas chaves ou
  muitos domínios significam operadores e caminhos independentes.

### Precisão do núcleo e das APIs

- Verificar entre implementações as restrições JSON e criptográficas propostas
  nas MIPs 01 e 02, sem interpretações diferentes dos mesmos dados.
- Fechar a descrição pública de limites operacionais, profundidade e política
  para relógios no futuro. Inteiros seguros já são a proposta do rascunho.
- Completar exemplos verificáveis nas novas MIPs quando seus formatos forem
  fechados; o exemplo de ID e assinatura do núcleo já está na MIP-02.
- Alocação de kinds, identificação de capacidades e perfil mínimo de compatibilidade.
- Formatos completos de resposta, erros e negociação entre `QUERY` e o caminho
  alternativo com `POST`.
- Validar as escolhas de filtro, ordenação e paginação da MIP-03, sobretudo
  quando entram eventos ou desaparecem cópias durante um percurso.
- Preservação do estado preferido após expiração de revisões: eliminar uma
  retirada não pode fazer uma revisão antiga reaparecer silenciosamente como
  atual. Ainda é preciso escolher regras de retenção ou memória de estado.
- Fechar limites e expiração de cursores e o tratamento de lotes de sincronização
  com eventos inválidos ou rejeitados. Os vínculos a relay/filtros e a mudança
  de limite por lote já estão descritos na MIP-03.
- Significado exato do compromisso de retenção, exceções e renovação.
- Seleção de pares, limites de filas, falhas que justificam nova tentativa,
  memória de IDs e descrição pública das políticas.
- Anúncios de relay: comprovação de identidade no endpoint, expiração, atualização,
  prevenção de anúncios regressivos e restrições a endereços perigosos em
  conexões automáticas.
- Formato do conteúdo dos artigos, estados editoriais completos, representação
  de links e renderização segura nos clientes.

A reescrita documental já está nas MIPs. O próximo passo para torná-las uma
especificação aceita é resolver e validar as pendências, não tratar os pontos
em aberto como detalhes que cada implementação pode inventar.

## 19. Escolhas concretas desta reescrita

Estas escolhas dão precisão ao rascunho escrito. Não devem ser confundidas com
pontos que já estavam todos fechados na conversa nem com uma versão final:

- Manter a reserva de kind `1` para publicações, sem reutilizar os antigos
  `0`, `2` e `3` para outros significados. Não alocar os novos kinds antes de
  fechar seus formatos.
- Usar hexadecimal minúsculo para chave pública e assinatura externa do evento,
  inteiros seguros, rejeição de propriedades JSON duplicadas e Unicode inválido.
  Zero negativo segue a normalização de JCS para zero.
- Exigir status explícito `published` ou `withdrawn` em publicações e identificar
  o autor simples pelo `signer`, sem delegação presumida.
- Usar `application/json` nos corpos das consultas e exigir `limit` positivo.
  `filters` vazio é inválido; `[{}]` é a forma explícita de consultar tudo que
  o relay permita.
- Exigir kinds explícitos para filtros de cabeçalho e para `view: current`,
  evitando aplicar um caminho a tipos que lhe dão significados diferentes.
- Ordenar consultas por `created_at` e ID, ambos decrescentes. A paginação comum
  acompanha o conjunto disponível, sem promessa de snapshot; eventos antigos
  recebidos tardiamente devem ser acompanhados por sincronização.
- Fixar, no início de uma paginação `current`, os IDs escolhidos para aquele
  percurso. Se uma cópia desaparecer, não substituí-la por uma revisão antiga.
- Vincular o cursor de consulta ao pedido, incluindo limite e visão. Vincular
  o cursor de sincronização a relay e filtros, permitindo mudar apenas o tamanho
  do lote sem reiniciar o acompanhamento.

A MIP-05 concentra o quadro de prontidão. Mensagens privadas, anúncios de relay
e backup ainda não têm formatos interoperáveis completos. Não foi adicionado
código de cliente/relay nem infraestrutura de schemas, ferramentas ou vetores
de teste separados.
