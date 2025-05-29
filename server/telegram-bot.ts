import { Telegraf, Context } from 'telegraf';
import { message } from 'telegraf/filters';
import type { IStorage } from './storage';
import { calculateNextAvailableSlot } from '../client/src/lib/timeSlots';
import path from 'path';
import fs from 'fs';

interface OrderSession {
  step: 'shopping' | 'name' | 'phone' | 'address' | 'timeslot' | 'review' | 'complete';
  items: Array<{ name: string; price: number; quantity: number; variants?: string }>;
  customerName?: string;
  phone?: string;
  address?: string;
  selectedSlot?: string;
  total?: number;
}

const sessions = new Map<string, OrderSession>();

const menuCategories = {
  'rings': {
    name: '🧿 Cock Rings & Toys',
    items: [
      { name: 'Cock Ring – Pack of 3', price: 8000, variants: [] },
      { name: 'Cock Ring Vibrator', price: 6000, variants: [] },
      { name: 'Spikey Jelly', price: 16000, variants: ['Red', 'Black'] },
      { name: '"Th Bolitas" Jelly', price: 16000, variants: [] },
      { name: 'Portable Wired Vibrator Egg', price: 13000, variants: [] },
      { name: 'Delay Collar', price: 20000, variants: [] },
      { name: 'Delay Ejaculation Buttplug', price: 20000, variants: [] },
      { name: '8 Inches African Version Dildo', price: 37000, variants: ['Black', 'Clear', 'Pink'] },
      { name: 'Masturbator Cup', price: 12000, variants: ['Yellow (Mouth)', 'Gray (Arse)', 'Black (Vagina)'] }
    ]
  },
  'lubes': {
    name: '💧 Lubes & Condoms',
    items: [
      { name: 'Monogatari Lube Tube', price: 12000, variants: [] },
      { name: 'Monogatari Lube Pinhole', price: 12000, variants: [] },
      { name: 'Monogatari Flavored Lube', price: 20000, variants: ['Peach', 'Strawberry', 'Cherry'] },
      { name: 'Ultra Thin 001 Natural Latex Condom', price: 9000, variants: ['Black', 'Long Battle', 'Blue', 'Naked Pleasure', 'Granule Passion'] }
    ]
  },
  'enhancers': {
    name: '💥 Performance Enhancers',
    items: [
      { name: 'Maxman (per Tab)', price: 4000, variants: [] },
      { name: 'Maxman (per Pad)', price: 40000, variants: [], promo: 'Php 50 discount' }
    ]
  },
  'accessories': {
    name: '🍃 Spicy Accessories',
    items: [
      { name: 'Eucalyptus Menthol 15–20 ml', price: 100000, variants: [] },
      { name: 'Eucalyptus Menthol 25–30 ml', price: 150000, variants: [] },
      { name: 'Eucalyptus Menthol 35–40 ml', price: 200000, variants: [] },
      { name: 'Mouth Fresheners', price: 9000, variants: ['Peach', 'Mint'] }
    ]
  },
  'essentials': {
    name: '💉 Essentials',
    items: [
      { name: 'Insulin Syringe', price: 2000, variants: [] },
      { name: 'Sterile Water for Injection', price: 1500, variants: [] }
    ]
  }
};

// Flatten all items for easy access
const allMenuItems = Object.values(menuCategories).flatMap(category => 
  category.items.map((item, index) => ({
    ...item,
    categoryId: Object.keys(menuCategories).find(key => menuCategories[key as keyof typeof menuCategories] === category),
    globalIndex: index
  }))
);

let menuItemCounter = 1;
const menuItemsWithNumbers = allMenuItems.map(item => ({
  ...item,
  number: menuItemCounter++
}));

export function initTelegramBot(storage: IStorage, broadcast: (data: any) => void) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || 'your_bot_token_here';
  
  if (!botToken || botToken === 'your_bot_token_here') {
    console.warn('Telegram bot token not provided. Bot features will be limited.');
    return { telegram: { sendMessage: () => Promise.resolve(), sendPhoto: () => Promise.resolve() } };
  }

  const bot = new Telegraf(botToken);

  // Start command with category buttons
  bot.start((ctx) => {
    const chatId = ctx.chat?.id.toString() || '';
    const session = sessions.get(chatId);
    
    const welcomeMessage = `
🌟 Kamusta, ${ctx.from?.first_name}! Welcome sa aming spicy shop! 🌟

Ang saya-saya namin na makakita kayo dito! Ready na ba kayo for some exciting products? 🔥✨

Choose a category para magsimula ng shopping! 😊🤫
    `;
    
    const categoryButtons = Object.entries(menuCategories).map(([key, category]) => 
      [{ text: category.name, callback_data: `category_${key}` }]
    );
    
    // Add cart button if user has items
    if (session && session.items.length > 0) {
      categoryButtons.push([{ text: `🛒 View Cart (${session.items.length} items)`, callback_data: 'view_cart' }]);
    }
    
    ctx.reply(welcomeMessage.trim(), {
      reply_markup: {
        inline_keyboard: categoryButtons
      }
    });
  });

  // Menu command - show categories
  bot.command('menu', (ctx) => {
    const chatId = ctx.chat?.id.toString() || '';
    const session = sessions.get(chatId);
    
    const menuMessage = '🔥 **SPICY CATALOG** 🔥\n\nChoose a category to browse:';
    
    const categoryButtons = Object.entries(menuCategories).map(([key, category]) => 
      [{ text: category.name, callback_data: `category_${key}` }]
    );
    
    // Add cart button if user has items
    if (session && session.items.length > 0) {
      categoryButtons.push([{ text: `🛒 View Cart (${session.items.length} items)`, callback_data: 'view_cart' }]);
    }
    
    ctx.reply(menuMessage, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: categoryButtons
      }
    });
  });

  // Cart command
  bot.command('cart', (ctx) => {
    const chatId = ctx.chat?.id.toString() || '';
    const session = sessions.get(chatId);
    
    if (!session || session.items.length === 0) {
      return ctx.reply('🛒 Your cart is empty!\n\nType /start to browse our catalog.');
    }
    
    let cartText = '🛒 **YOUR CART** 🛒\n\n';
    
    session.items.forEach((item, index) => {
      cartText += `${index + 1}. ${item.quantity}x ${item.name}\n`;
      cartText += `   ₱${((item.price * item.quantity) / 100).toFixed(2)}\n\n`;
    });
    
    cartText += `**Total: ₱${(session.total! / 100).toFixed(2)}**`;
    
    const cartButtons = [
      [
        { text: '🛍️ Continue Shopping', callback_data: 'continue_shopping' },
        { text: '🗑️ Clear Cart', callback_data: 'clear_cart' }
      ],
      [{ text: '💳 Checkout', callback_data: 'start_checkout' }]
    ];
    
    // Add quantity adjustment buttons for each item
    session.items.forEach((item, index) => {
      cartButtons.splice(-1, 0, [
        { text: `➖ ${item.name}`, callback_data: `remove_${index}` },
        { text: `➕ ${item.name}`, callback_data: `add_${index}` }
      ]);
    });
    
    ctx.reply(cartText, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: cartButtons
      }
    });
  });

  // Handle category selection
  bot.action(/^category_(.+)$/, (ctx) => {
    const categoryKey = ctx.match[1];
    const category = menuCategories[categoryKey as keyof typeof menuCategories];
    
    if (!category) {
      return ctx.answerCbQuery('Category not found');
    }
    
    const itemButtons = category.items.map((item, index) => {
      const itemNumber = menuItemsWithNumbers.find(numberedItem => numberedItem.name === item.name)?.number || index + 1;
      let buttonText = `${item.name} - ₱${(item.price / 100).toFixed(2)}`;
      if (buttonText.length > 64) {
        buttonText = buttonText.substring(0, 61) + '...';
      }
      return [{ text: buttonText, callback_data: `item_${itemNumber}` }];
    });
    
    // Add back button
    itemButtons.push([{ text: '⬅️ Back to Categories', callback_data: 'back_to_categories' }]);
    
    const message = `${category.name}\n\nSelect an item to add to cart:`;
    
    ctx.editMessageText(message, {
      reply_markup: {
        inline_keyboard: itemButtons
      }
    });
    
    ctx.answerCbQuery();
  });

  // Handle item selection
  bot.action(/^item_(\d+)$/, (ctx) => {
    const itemNumber = parseInt(ctx.match[1]);
    const selectedItem = menuItemsWithNumbers.find(item => item.number === itemNumber);
    
    if (!selectedItem) {
      return ctx.answerCbQuery('Item not found');
    }
    
    const chatId = ctx.chat?.id.toString() || '';
    let session = sessions.get(chatId);
    
    // Create new session if none exists or initialize for shopping
    if (!session) {
      session = {
        step: 'shopping',
        items: [],
        total: 0
      };
      sessions.set(chatId, session);
    }
    
    // Add item to cart
    const existingItemIndex = session.items.findIndex(item => item.name === selectedItem.name);
    if (existingItemIndex !== -1) {
      session.items[existingItemIndex].quantity += 1;
    } else {
      session.items.push({
        name: selectedItem.name,
        price: selectedItem.price,
        quantity: 1
      });
    }
    
    // Update total
    session.total = session.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    session.step = 'shopping';
    
    let itemDetails = `✅ Added to cart!\n\n**${selectedItem.name}**\n₱${(selectedItem.price / 100).toFixed(2)}`;
    
    if (selectedItem.variants && selectedItem.variants.length > 0) {
      itemDetails += `\n\nAvailable variants: ${selectedItem.variants.join(', ')}`;
    }
    
    if ('promo' in selectedItem && selectedItem.promo) {
      itemDetails += `\n🔥 ${selectedItem.promo}`;
    }
    
    const actionButtons = [
      [
        { text: '🛒 View Cart', callback_data: 'view_cart' },
        { text: '🛍️ Continue Shopping', callback_data: 'continue_shopping' }
      ],
      [{ text: '💳 Checkout', callback_data: 'start_checkout' }]
    ];
    
    ctx.editMessageText(itemDetails, { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: actionButtons
      }
    });
    ctx.answerCbQuery();
  });

  // Handle back to categories
  bot.action('back_to_categories', (ctx) => {
    const menuMessage = '🔥 **SPICY CATALOG** 🔥\n\nChoose a category to browse:';
    
    const categoryButtons = Object.entries(menuCategories).map(([key, category]) => 
      [{ text: category.name, callback_data: `category_${key}` }]
    );
    
    ctx.editMessageText(menuMessage, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: categoryButtons
      }
    });
    
    ctx.answerCbQuery();
  });

  // Handle view cart
  bot.action('view_cart', (ctx) => {
    const chatId = ctx.chat?.id.toString() || '';
    const session = sessions.get(chatId);
    
    if (!session || session.items.length === 0) {
      return ctx.answerCbQuery('Your cart is empty!');
    }
    
    let cartText = '🛒 **YOUR CART** 🛒\n\n';
    
    session.items.forEach((item, index) => {
      cartText += `${index + 1}. ${item.quantity}x ${item.name}\n`;
      cartText += `   ₱${((item.price * item.quantity) / 100).toFixed(2)}\n\n`;
    });
    
    cartText += `**Total: ₱${(session.total! / 100).toFixed(2)}**`;
    
    const cartButtons = [
      [
        { text: '🛍️ Continue Shopping', callback_data: 'continue_shopping' },
        { text: '🗑️ Clear Cart', callback_data: 'clear_cart' }
      ],
      [{ text: '💳 Checkout', callback_data: 'start_checkout' }]
    ];
    
    // Add quantity adjustment buttons for each item
    session.items.forEach((item, index) => {
      cartButtons.splice(-1, 0, [
        { text: `➖ ${item.name}`, callback_data: `remove_${index}` },
        { text: `➕ ${item.name}`, callback_data: `add_${index}` }
      ]);
    });
    
    ctx.editMessageText(cartText, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: cartButtons
      }
    });
    
    ctx.answerCbQuery();
  });

  // Handle continue shopping
  bot.action('continue_shopping', (ctx) => {
    const menuMessage = '🔥 **SPICY CATALOG** 🔥\n\nChoose a category to browse:';
    
    const categoryButtons = Object.entries(menuCategories).map(([key, category]) => 
      [{ text: category.name, callback_data: `category_${key}` }]
    );
    
    const chatId = ctx.chat?.id.toString() || '';
    const session = sessions.get(chatId);
    
    if (session && session.items.length > 0) {
      categoryButtons.push([{ text: '🛒 View Cart', callback_data: 'view_cart' }]);
    }
    
    ctx.editMessageText(menuMessage, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: categoryButtons
      }
    });
    
    ctx.answerCbQuery();
  });

  // Handle clear cart
  bot.action('clear_cart', (ctx) => {
    const chatId = ctx.chat?.id.toString() || '';
    sessions.delete(chatId);
    
    ctx.editMessageText('🗑️ Cart cleared! Ready for fresh shopping! 😊\n\nType /start to browse our catalog again.', {
      reply_markup: { inline_keyboard: [] }
    });
    
    ctx.answerCbQuery();
  });

  // Handle item quantity adjustments
  bot.action(/^(add|remove)_(\d+)$/, (ctx) => {
    const action = ctx.match[1];
    const itemIndex = parseInt(ctx.match[2]);
    const chatId = ctx.chat?.id.toString() || '';
    const session = sessions.get(chatId);
    
    if (!session || !session.items[itemIndex]) {
      return ctx.answerCbQuery('Item not found');
    }
    
    if (action === 'add') {
      session.items[itemIndex].quantity += 1;
    } else if (action === 'remove') {
      if (session.items[itemIndex].quantity > 1) {
        session.items[itemIndex].quantity -= 1;
      } else {
        session.items.splice(itemIndex, 1);
      }
    }
    
    // Update total
    session.total = session.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    if (session.items.length === 0) {
      sessions.delete(chatId);
      ctx.editMessageText('🗑️ Cart is now empty! Type /start to browse our catalog again.', {
        reply_markup: { inline_keyboard: [] }
      });
    } else {
      // Refresh cart view
      let cartText = '🛒 **YOUR CART** 🛒\n\n';
      
      session.items.forEach((item, index) => {
        cartText += `${index + 1}. ${item.quantity}x ${item.name}\n`;
        cartText += `   ₱${((item.price * item.quantity) / 100).toFixed(2)}\n\n`;
      });
      
      cartText += `**Total: ₱${(session.total! / 100).toFixed(2)}**`;
      
      const cartButtons = [
        [
          { text: '🛍️ Continue Shopping', callback_data: 'continue_shopping' },
          { text: '🗑️ Clear Cart', callback_data: 'clear_cart' }
        ],
        [{ text: '💳 Checkout', callback_data: 'start_checkout' }]
      ];
      
      // Add quantity adjustment buttons for each item
      session.items.forEach((item, index) => {
        cartButtons.splice(-1, 0, [
          { text: `➖ ${item.name}`, callback_data: `remove_${index}` },
          { text: `➕ ${item.name}`, callback_data: `add_${index}` }
        ]);
      });
      
      ctx.editMessageText(cartText, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: cartButtons
        }
      });
    }
    
    ctx.answerCbQuery();
  });

  // Handle checkout start
  bot.action('start_checkout', (ctx) => {
    const chatId = ctx.chat?.id.toString() || '';
    const session = sessions.get(chatId);
    
    if (!session || session.items.length === 0) {
      return ctx.answerCbQuery('Your cart is empty!');
    }
    
    session.step = 'name';
    
    let checkoutText = '💳 **CHECKOUT** 💳\n\n';
    checkoutText += `Items: ${session.items.length}\n`;
    checkoutText += `Total: ₱${(session.total! / 100).toFixed(2)}\n\n`;
    checkoutText += 'Para ma-proceed, please provide your **full name**:';
    
    ctx.editMessageText(checkoutText, { 
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [] }
    });
    
    ctx.answerCbQuery();
  });

  // Handle timeslot selection
  bot.action(/^timeslot_(\d+)$/, async (ctx) => {
    const slotIndex = parseInt(ctx.match[1]);
    const availableSlots = calculateNextAvailableSlot();
    const chatId = ctx.chat?.id.toString() || '';
    const session = sessions.get(chatId);
    
    if (!session || slotIndex < 0 || slotIndex >= availableSlots.length) {
      return ctx.answerCbQuery('Invalid selection');
    }
    
    session.selectedSlot = availableSlots[slotIndex];
    session.step = 'review';
    
    const reviewText = `
🔍 **ORDER REVIEW** 🔍

**Items:**
${session.items.map(item => `${item.quantity}x ${item.name} - ₱${((item.price * item.quantity) / 100).toFixed(2)}`).join('\n')}

**Total:** ₱${(session.total! / 100).toFixed(2)}

**Customer:** ${session.customerName}
**Phone:** ${session.phone}
**Address:** ${session.address}
**Delivery Time:** ${session.selectedSlot}

Everything looks good?
    `;
    
    const confirmButtons = [
      [{ text: '✅ CONFIRM ORDER', callback_data: 'confirm_order' }],
      [{ text: '❌ CANCEL', callback_data: 'cancel_order' }]
    ];
    
    ctx.editMessageText(reviewText.trim(), { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: confirmButtons
      }
    });
    
    ctx.answerCbQuery();
  });

  // Handle order confirmation
  bot.action('confirm_order', async (ctx) => {
    const chatId = ctx.chat?.id.toString() || '';
    const session = sessions.get(chatId);
    
    if (!session) {
      return ctx.answerCbQuery('Session expired. Please start over.');
    }
    
    try {
      // Create order in storage
      const order = await storage.createOrder({
        telegramUsername: ctx.from?.username || 'unknown',
        telegramChatId: chatId,
        customerName: session.customerName!,
        phone: session.phone!,
        address: session.address!,
        items: session.items.map(item => `${item.quantity}x ${item.name}`),
        total: session.total!,
        deliverySlot: session.selectedSlot!,
        status: 'pending'
      });

      // Create initial timeline event
      await storage.createTimelineEvent({
        orderId: order.id,
        event: 'confirmed'
      });

      // Save confirmation message
      await storage.createMessage({
        orderId: order.id,
        sender: 'customer',
        message: 'Order confirmed via Telegram bot'
      });

      // Broadcast to dashboard
      broadcast({ type: 'orderCreated', order });

      const confirmText = `
🎉 **ORDER CONFIRMED!** 🎉

Order ID: #${order.id}

Ang galing! Your order has been received! 

Wait lang for our payment QR code - isesend namin sa inyo shortly! After payment, just upload your receipt dito sa chat! 📸

Maraming salamat for choosing us! We're so excited to serve you! 🌟
      `;

      ctx.editMessageText(confirmText.trim(), { 
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [] }
      });
      
      // Clear session
      sessions.delete(chatId);

    } catch (error) {
      console.error('Error creating order:', error);
      ctx.answerCbQuery('Sorry! May error sa system. Please try again later!');
    }
  });

  // Handle order cancellation
  bot.action('cancel_order', (ctx) => {
    const chatId = ctx.chat?.id.toString() || '';
    sessions.delete(chatId);
    
    ctx.editMessageText('Order cancelled! No worries, you can start again anytime! Type /start when ready! 😊', {
      reply_markup: { inline_keyboard: [] }
    });
    
    ctx.answerCbQuery();
  });

  // Handle menu item selection
  bot.on(message('text'), async (ctx) => {
    const chatId = ctx.chat.id.toString();
    const text = ctx.message.text.trim();

    // Check if user has an active session
    let session = sessions.get(chatId);

    // Handle menu item selection (numbers)
    const menuMatch = text.match(/^(\d+)(?:\s+x(\d+))?$/i);
    if (menuMatch && !session) {
      const itemNumber = parseInt(menuMatch[1]);
      const quantity = parseInt(menuMatch[2]) || 1;

      const selectedItem = menuItemsWithNumbers.find(item => item.number === itemNumber);
      if (selectedItem) {
        
        // Start new order session
        session = {
          step: 'name',
          items: [{
            name: selectedItem.name,
            price: selectedItem.price,
            quantity: quantity
          }],
          total: selectedItem.price * quantity
        };
        sessions.set(chatId, session);

        const orderSummary = `
🎉 Ang ganda ng choice mo! 

**Your Order:**
${quantity}x ${selectedItem.name} - ₱${((selectedItem.price * quantity) / 100).toFixed(2)}

Para ma-proceed natin, kailangan namin ng details mo! 
Please tell us your **full name**: 😊
        `;

        return ctx.reply(orderSummary.trim(), { parse_mode: 'Markdown' });
      } else {
        return ctx.reply('Ay sorry! Invalid item number. Type /menu para makita ulit ang options! 😅');
      }
    }

    // Handle session steps
    if (session) {
      switch (session.step) {
        case 'name':
          if (text.length < 2) {
            return ctx.reply('Please provide your full name po! 😊');
          }
          session.customerName = text;
          session.step = 'phone';
          return ctx.reply('Salamat! Now, please share your **phone number** (with +63 or 09xx format): 📱');

        case 'phone':
          const phoneRegex = /^(\+63|0)9\d{9}$/;
          if (!phoneRegex.test(text.replace(/\s/g, ''))) {
            return ctx.reply('Ay mali ang format! Please use +63 9XX XXX XXXX or 09XX XXX XXXX format 📱');
          }
          session.phone = text;
          session.step = 'address';
          return ctx.reply('Perfect! Now please give us your **complete delivery address**: 🏠\n(Include street, barangay, city para sure na mahanap kayo!)');

        case 'address':
          if (text.length < 10) {
            return ctx.reply('Please provide a more complete address para sure na madeliver namin! 😊');
          }
          session.address = text;
          session.step = 'timeslot';
          
          // Calculate available time slots and show as buttons
          const availableSlots = calculateNextAvailableSlot();
          
          const slotButtons = availableSlots.map((slot, index) => 
            [{ text: `${slot}`, callback_data: `timeslot_${index}` }]
          );
          
          const slotText = 'Almost done na! Choose your **delivery time slot**: ⏰';
          
          return ctx.reply(slotText, { 
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: slotButtons
            }
          });

        case 'timeslot':
          // This should not happen with buttons, but keep for fallback
          const slotIndex = parseInt(text) - 1;
          const availableSlots2 = calculateNextAvailableSlot();
          
          if (slotIndex >= 0 && slotIndex < availableSlots2.length) {
            session.selectedSlot = availableSlots2[slotIndex];
            session.step = 'review';
            
            // Show order review with confirm buttons
            const reviewText = `
🔍 **ORDER REVIEW** 🔍

**Items:**
${session.items.map(item => `${item.quantity}x ${item.name} - ₱${((item.price * item.quantity) / 100).toFixed(2)}`).join('\n')}

**Total:** ₱${(session.total! / 100).toFixed(2)}

**Customer:** ${session.customerName}
**Phone:** ${session.phone}
**Address:** ${session.address}
**Delivery Time:** ${session.selectedSlot}

Everything looks good?
            `;
            
            const confirmButtons = [
              [{ text: '✅ CONFIRM ORDER', callback_data: 'confirm_order' }],
              [{ text: '❌ CANCEL', callback_data: 'cancel_order' }]
            ];
            
            return ctx.reply(reviewText.trim(), { 
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: confirmButtons
              }
            });
          } else {
            return ctx.reply('Invalid time slot! Please choose from the available options. 😅');
          }

        case 'review':
          if (text.toLowerCase() === 'confirm') {
            try {
              // Create order in storage
              const order = await storage.createOrder({
                telegramUsername: ctx.from?.username || 'unknown',
                telegramChatId: chatId,
                customerName: session.customerName!,
                phone: session.phone!,
                address: session.address!,
                items: session.items.map(item => `${item.quantity}x ${item.name}`),
                total: session.total!,
                deliverySlot: session.selectedSlot!,
                status: 'pending'
              });

              // Create initial timeline event
              await storage.createTimelineEvent({
                orderId: order.id,
                event: 'confirmed'
              });

              // Save confirmation message
              await storage.createMessage({
                orderId: order.id,
                sender: 'customer',
                message: 'Order confirmed via Telegram bot'
              });

              // Broadcast to dashboard
              broadcast({ type: 'orderCreated', order });

              const confirmText = `
🎉 **ORDER CONFIRMED!** 🎉

Order ID: #${order.id}

Ang galing! Your order has been received! 

Wait lang for our payment QR code - isesend namin sa inyo shortly! After payment, just upload your receipt dito sa chat! 📸

Maraming salamat for choosing us! We're so excited to serve you! 🌟
              `;

              ctx.reply(confirmText.trim(), { parse_mode: 'Markdown' });
              
              // Clear session
              sessions.delete(chatId);
              session.step = 'complete';

            } catch (error) {
              console.error('Error creating order:', error);
              ctx.reply('Ay sorry! May error sa system. Please try again later! 😅');
            }
          } else if (text.toLowerCase() === 'cancel') {
            sessions.delete(chatId);
            ctx.reply('Order cancelled! No worries, you can start again anytime! Type /menu when ready! 😊');
          } else {
            ctx.reply('Please type "CONFIRM" to place order or "CANCEL" to start over! 😊');
          }
          break;
      }
    } else if (!menuMatch) {
      // General chat - save as message if user has existing order
      const existingOrder = await storage.getOrderByChatId(chatId);
      if (existingOrder) {
        await storage.createMessage({
          orderId: existingOrder.id,
          sender: 'customer',
          message: text
        });
        broadcast({ 
          type: 'messageReceived', 
          orderId: existingOrder.id, 
          message: text,
          sender: 'customer'
        });
      }
      
      // Friendly response
      const responses = [
        'Hello po! Type /menu to see our yummy offerings! 😋',
        'Kamusta! Ready na ba kayong mag-order? Type /menu! 🍔',
        'Hi there! Para makita ang menu, type /menu lang! ✨'
      ];
      const randomResponse = responses[Math.floor(Math.random() * responses.length)];
      ctx.reply(randomResponse);
    }
  });

  // Handle photo uploads (payment proofs)
  bot.on(message('photo'), async (ctx) => {
    const chatId = ctx.chat.id.toString();
    
    try {
      const existingOrder = await storage.getOrderByChatId(chatId);
      if (!existingOrder) {
        return ctx.reply('No active order found. Please place an order first! 😊');
      }

      // Get the largest photo
      const photos = ctx.message.photo;
      const largestPhoto = photos[photos.length - 1];
      
      // Get file from Telegram
      const file = await ctx.telegram.getFile(largestPhoto.file_id);
      const fileUrl = `https://api.telegram.org/file/bot${botToken}/${file.file_path}`;
      
      // Download and save file
      const response = await fetch(fileUrl);
      const buffer = await response.arrayBuffer();
      const filename = `payment-proof-${existingOrder.id}-${Date.now()}.jpg`;
      const filepath = path.join(process.cwd(), 'uploads', filename);
      
      fs.writeFileSync(filepath, Buffer.from(buffer));
      
      // Update order with payment proof
      await storage.updateOrder(existingOrder.id, {
        paymentProof: `/uploads/${filename}`,
        status: 'confirmed'
      });

      // Create timeline event
      await storage.createTimelineEvent({
        orderId: existingOrder.id,
        event: 'payment_received'
      });

      // Save message
      await storage.createMessage({
        orderId: existingOrder.id,
        sender: 'customer',
        message: 'Payment proof uploaded'
      });

      // Broadcast to dashboard
      broadcast({ 
        type: 'paymentProofReceived', 
        orderId: existingOrder.id,
        paymentProof: `/uploads/${filename}`
      });

      ctx.reply(`
🎉 Payment proof received! Salamat po! 

Your order is now being processed! We'll update you once it's ready for delivery! 

Keep this chat open para ma-receive ninyo ang updates! 😊✨
      `.trim());

    } catch (error) {
      console.error('Error handling payment proof:', error);
      ctx.reply('Sorry, may problema sa pag-receive ng image. Please try again! 😅');
    }
  });

  // Error handling
  bot.catch((err, ctx) => {
    console.error('Bot error:', err);
    ctx.reply('Oops! May technical issue. Please try again later! 😅');
  });

  // Start bot
  bot.launch().then(() => {
    console.log('Telegram bot started successfully');
  }).catch((error) => {
    console.error('Failed to start Telegram bot:', error);
  });

  // Graceful shutdown
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));

  return bot;
}
