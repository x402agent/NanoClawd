const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());

const JUPITER_API_KEY = process.env.JUPITER_API_KEY;
const JUPITER_ULTRA_ENDPOINT = process.env.JUPITER_ULTRA_ENDPOINT;

// Endpoint to get a swap order
app.post('/get-ultra-order', async (req, res) => {
  const { inputMint, outputMint, amount, slippageBps } = req.body;
  
  const params = new URLSearchParams({
    inputMint,
    outputMint,
    amount,
    slippageBps,
  });

  try {
    const response = await axios.get(`${JUPITER_ULTRA_ENDPOINT}/order?${params}`, {
      headers: {
        'x-api-key': JUPITER_API_KEY,
      },
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to execute the swap
app.post('/execute-ultra-order', async (req, res) => {
  const { requestId, transaction } = req.body;

  try {
    const response = await axios.post(`${JUPITER_ULTRA_ENDPOINT}/execute`, {
      requestId,
      signedTransaction: transaction,
    }, {
      headers: {
        'x-api-key': JUPITER_API_KEY,
      },
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Jupiter Ultra MCP server running on port ${PORT}`);
});