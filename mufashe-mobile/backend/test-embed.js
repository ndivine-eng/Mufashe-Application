require("dotenv").config();
const { createEmbedding } = require("./src/services/embedding.service");

(async () => {
  const vec = await createEmbedding("Hello from MUFASHE");
  console.log("Embedding length:", vec.length);
})();