// ═══════════════════════════════════════════════════════════════════════════════
// ETH CONVERSION ENDPOINTS - ADD THESE TO YOUR BACKEND
// Copy and paste into your server.js file
// ═══════════════════════════════════════════════════════════════════════════════

// Universal convert endpoint - REAL ETH TRANSFER
app.post('/convert', async (req, res) => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('💸 CONVERT/WITHDRAW REQUEST');
  
  try {
    const { to, toAddress, amount, amountETH, amountUSD, percentage, treasury } = req.body;
    const destination = to || toAddress || treasury || BACKEND_WALLET;
    
    console.log('📍 Destination:', destination);
    
    if (!destination) {
      return res.status(400).json({ error: 'Missing destination address' });
    }
    
    // Calculate amount based on what's provided
    let ethAmount = amountETH || amount;
    if (!ethAmount && amountUSD) {
      ethAmount = amountUSD / ETH_PRICE;
      console.log('📊 Converted $' + amountUSD + ' → ' + ethAmount.toFixed(6) + ' ETH @ $' + ETH_PRICE);
    }
    
    if (!ethAmount || ethAmount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    
    console.log('💰 Requested:', ethAmount, 'ETH');
    
    // Get wallet and check balance
    const wallet = await getWallet();
    const balance = await wallet.getBalance();
    const balanceETH = parseFloat(ethers.utils.formatEther(balance));
    console.log('💰 Current balance:', balanceETH.toFixed(6), 'ETH');
    
    // If percentage specified, calculate from balance
    const GAS_RESERVE = 0.003;
    if (percentage) {
      ethAmount = (balanceETH - GAS_RESERVE) * (percentage / 100);
    }
    
    // Get gas estimate
    const gasPrice = await wallet.provider.getGasPrice();
    const gasCostWei = gasPrice.mul(21000).mul(2);
    const gasCostETH = parseFloat(ethers.utils.formatEther(gasCostWei));
    
    const totalNeeded = ethAmount + gasCostETH;
    if (totalNeeded > balanceETH) {
      const maxWithdrawable = balanceETH - gasCostETH - 0.0005;
      return res.status(400).json({ 
        error: 'Insufficient balance (need amount + gas)',
        available: balanceETH,
        requested: ethAmount,
        gasEstimate: gasCostETH,
        maxWithdrawable: maxWithdrawable > 0 ? maxWithdrawable : 0,
        ethPrice: ETH_PRICE
      });
    }
    
    // SEND REAL ON-CHAIN ETH TRANSACTION
    console.log('📤 Sending transaction...');
    const tx = await wallet.sendTransaction({
      to: destination,
      value: ethers.utils.parseEther(ethAmount.toFixed(18)),
      maxFeePerGas: gasPrice.mul(2),
      maxPriorityFeePerGas: ethers.utils.parseUnits('2', 'gwei'),
      gasLimit: 21000
    });
    
    console.log('⏳ TX submitted:', tx.hash);
    const receipt = await tx.wait(1);
    
    const gasUsedETH = parseFloat(ethers.utils.formatEther(receipt.gasUsed.mul(receipt.effectiveGasPrice)));
    
    console.log('✅ TRANSACTION CONFIRMED');
    console.log('💸 Sent:', ethAmount.toFixed(6), 'ETH to', destination);
    console.log('🔗 TX:', tx.hash);
    
    res.json({
      success: true,
      txHash: tx.hash,
      amount: ethAmount,
      amountUSD: ethAmount * ETH_PRICE,
      ethPrice: ETH_PRICE,
      to: destination,
      gasUsed: gasUsedETH,
      blockNumber: receipt.blockNumber,
      confirmed: true
    });
  } catch (e) {
    console.log('❌ CONVERT ERROR:', e.message);
    res.status(500).json({ error: e.message, code: e.code });
  }
});

// Alias endpoints - all route to /convert
app.post('/withdraw', (req, res) => {
  req.body.to = req.body.to || req.body.toAddress;
  // Forward to convert logic
  return handleConvert(req, res);
});

app.post('/send-eth', async (req, res) => {
  const { to, amount, treasury } = req.body;
  req.body.to = to || treasury;
  req.body.amountETH = amount;
  // Forward to convert
  return handleConvert(req, res);
});

app.post('/coinbase-withdraw', (req, res) => handleConvert(req, res));
app.post('/send-to-coinbase', (req, res) => handleConvert(req, res));
app.post('/backend-to-coinbase', (req, res) => handleConvert(req, res));
app.post('/treasury-to-coinbase', (req, res) => handleConvert(req, res));

// Helper function (or just copy the /convert logic)
async function handleConvert(req, res) {
  // Same logic as /convert endpoint above
}
