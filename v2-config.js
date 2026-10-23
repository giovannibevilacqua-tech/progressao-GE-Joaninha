/* ============================================================
   v2-config.js — configuração única da migração (Firebase v2)
   Edite SÓ este arquivo quando o tutorial pedir.
   ============================================================ */
window.V2_CONFIG = {
  // Banco de dados (os mesmos valores que já existem nos seus apps)
  DB_URL: "https://joaninha-progressao-default-rtdb.firebaseio.com",
  API_KEY: "AIzaSyB50r7SU6qU_dwq03v_oQksLi1bAxbU614",

  // Pasta nova do banco onde os dados migrados ficam (o app antigo NÃO usa).
  RAIZ: "v2",

  // Nomes das páginas: "-v2" durante o teste; "" quando você for oficializar.
  SUFIXO: "",

  // true = mostra a faixa laranja "VERSÃO DE TESTE". Mude para false ao oficializar.
  MODO_TESTE: false,

  // Listas de objetos que têm "id" próprio: viram nós pelo id (e não pela posição).
  ID_ARRAYS: {
    escoteira: ["eventos", "extraJovens", "patrulhas"],
    senior: ["PATRULHAS_SR"]
  },

  LIMITE_ANEXO_MB: 3
};
