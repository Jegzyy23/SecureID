const express = require('express');
const router  = express.Router();
const { Op }  = require('sequelize');
const { protect } = require('../middleware/auth');
const { Card, Transaction, Alert } = require('../models');

// ── GET /api/cards ────────────────────────────────────────────────
router.get('/', protect, async (req, res) => {
  try {
    // Sequelize: findAll with where clause + include related transactions
    const cards = await Card.findAll({
      where: { user_id: req.user.id },
      include: [{
        model: Transaction,
        as: 'transactions',
        limit: 5,
        order: [['created_at', 'DESC']]  // last 5 transactions
      }],
      order: [['created_at', 'DESC']]
    });

    const result = cards.map(c => ({
      id: c.id,
      masked: c.getMasked(),
      cardHolder: c.card_holder,
      bank: c.bank,
      cardType: c.card_type,
      expiryMonth: c.expiry_month,
      expiryYear: c.expiry_year,
      status: c.status,
      frozenAt: c.frozen_at,
      frozenReason: c.frozen_reason,
      transactionHistory: c.transactions || []
    }));

    res.json({ success: true, cards: result });
  } catch (err) {
    console.error('Get cards error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch cards.' });
  }
});

// ── POST /api/cards/add ───────────────────────────────────────────
router.post('/add', protect, async (req, res) => {
  try {
    const { cardNumber, cardHolder, bank, cardType, expiryMonth, expiryYear } = req.body;

    if (!cardNumber || !cardHolder || !bank) {
      return res.status(400).json({ success: false, message: 'Card number, holder name and bank are required.' });
    }

    // Check for duplicate card for this user
    const existing = await Card.findOne({
      where: { user_id: req.user.id, card_number: cardNumber }
    });
    if (existing) {
      return res.status(409).json({ success: false, message: 'This card is already linked.' });
    }

    const card = await Card.create({
      user_id: req.user.id,
      card_number: cardNumber,
      card_holder: cardHolder.toUpperCase().trim(),
      bank,
      card_type: cardType || 'VERVE',
      expiry_month: expiryMonth || null,
      expiry_year: expiryYear || null
    });

    await Alert.create({
      user_id: req.user.id,
      type: 'login_success',
      message: `New card linked: ${card.getMasked()} (${bank}).`,
      severity: 'info'
    });

    res.status(201).json({
      success: true,
      message: 'Card linked successfully.',
      card: {
        id: card.id,
        masked: card.getMasked(),
        bank: card.bank,
        cardType: card.card_type,
        status: card.status
      }
    });
  } catch (err) {
    console.error('Add card error:', err);
    res.status(500).json({ success: false, message: 'Failed to add card.' });
  }
});

// ── POST /api/cards/:id/freeze ────────────────────────────────────
router.post('/:id/freeze', protect, async (req, res) => {
  try {
    const { reason } = req.body;

    const card = await Card.findOne({
      where: { id: req.params.id, user_id: req.user.id }
    });

    if (!card) return res.status(404).json({ success: false, message: 'Card not found.' });
    if (card.status === 'frozen') return res.status(400).json({ success: false, message: 'Card is already frozen.' });

    await card.update({
      status: 'frozen',
      frozen_at: new Date(),
      frozen_reason: reason || 'User requested freeze'
    });

    await Alert.create({
      user_id: req.user.id,
      type: 'card_frozen',
      message: `Card ${card.getMasked()} (${card.bank}) has been frozen. Reason: ${card.frozen_reason}`,
      severity: 'warning',
      metadata: { cardId: card.id }
    });

    res.json({
      success: true,
      message: `Card ${card.getMasked()} frozen successfully.`,
      card: { id: card.id, status: 'frozen', frozenAt: card.frozen_at }
    });
  } catch (err) {
    console.error('Freeze error:', err);
    res.status(500).json({ success: false, message: 'Failed to freeze card.' });
  }
});

// ── POST /api/cards/:id/unfreeze ──────────────────────────────────
router.post('/:id/unfreeze', protect, async (req, res) => {
  try {
    const card = await Card.findOne({
      where: { id: req.params.id, user_id: req.user.id }
    });

    if (!card) return res.status(404).json({ success: false, message: 'Card not found.' });
    if (card.status !== 'frozen') return res.status(400).json({ success: false, message: 'Card is not frozen.' });

    await card.update({ status: 'active', frozen_at: null, frozen_reason: null });

    await Alert.create({
      user_id: req.user.id,
      type: 'card_unfrozen',
      message: `Card ${card.getMasked()} (${card.bank}) has been unfrozen and is now active.`,
      severity: 'info',
      metadata: { cardId: card.id }
    });

    res.json({
      success: true,
      message: `Card ${card.getMasked()} unfrozen successfully.`,
      card: { id: card.id, status: 'active' }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to unfreeze card.' });
  }
});

// ── POST /api/cards/emergency-freeze ─────────────────────────────
// Freeze ALL active cards instantly
router.post('/emergency-freeze', protect, async (req, res) => {
  try {
    // Sequelize: update() with where clause = UPDATE cards SET ... WHERE ...
    const [frozenCount] = await Card.update(
      {
        status: 'frozen',
        frozen_at: new Date(),
        frozen_reason: 'EMERGENCY: Phone theft / suspicious activity'
      },
      {
        where: {
          user_id: req.user.id,
          status: 'active'   // only freeze currently active cards
        }
      }
    );

    await Alert.create({
      user_id: req.user.id,
      type: 'emergency_freeze',
      message: `🚨 EMERGENCY FREEZE activated. ${frozenCount} card(s) frozen instantly.`,
      severity: 'critical'
    });

    res.json({
      success: true,
      message: `Emergency freeze activated! ${frozenCount} card(s) are now frozen.`,
      frozenCount
    });
  } catch (err) {
    console.error('Emergency freeze error:', err);
    res.status(500).json({ success: false, message: 'Emergency freeze failed.' });
  }
});

// ── POST /api/cards/:id/simulate-transaction ──────────────────────
router.post('/:id/simulate-transaction', protect, async (req, res) => {
  try {
    const { amount, description } = req.body;

    const card = await Card.findOne({
      where: { id: req.params.id, user_id: req.user.id }
    });

    if (!card) return res.status(404).json({ success: false, message: 'Card not found.' });

    const isApproved = card.status === 'active';

    // Save transaction as a proper row in the transactions table
    const txn = await Transaction.create({
      card_id: card.id,
      user_id: req.user.id,
      amount: parseFloat(amount) || 5000.00,
      description: description || 'ATM Withdrawal',
      type: 'debit',
      status: isApproved ? 'success' : 'declined'
    });

    res.json({
      success: true,
      approved: isApproved,
      message: isApproved
        ? '✅ Transaction approved.'
        : '❌ Transaction declined — card is frozen.',
      transaction: {
        id: txn.id,
        amount: txn.amount,
        description: txn.description,
        status: txn.status,
        date: txn.created_at
      }
    });
  } catch (err) {
    console.error('Transaction error:', err);
    res.status(500).json({ success: false, message: 'Simulation failed.' });
  }
});

module.exports = router;
