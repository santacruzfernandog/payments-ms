import { Injectable } from '@nestjs/common';
import { envs } from 'src/config';
import Stripe from 'stripe';
import { PaymentSessionDto } from './dto/payment-session.dto';
import e, { Request, Response } from 'express';

@Injectable()
export class PaymentsService {
  private readonly stripe = new Stripe(envs.stripeSecret);

  async createPaymentSession(paymentSessionDto: PaymentSessionDto) {
    const { currency, items, orderId } = paymentSessionDto;

    const lineItems = items.map(item => {
        return {
          price_data: {
            currency,
            product_data: {
              name: item.name,
            },
            unit_amount: Math.round(item.price*100), // int number with the cents implicit in the value
          },
          quantity: item.quantity,
        };
    })

    const session = await this.stripe.checkout.sessions.create({
      // Here you need to pass the order details
      payment_intent_data: {
        metadata: { orderId },
      },
      line_items: lineItems,
      mode: 'payment',
      success_url: envs.stripeSuccessUrl,
      cancel_url: envs.stripeCancelUrl,
    });

    return session;
  }

  async stripeWebhookHandler(req: Request, res: Response) {
    const signature = req.headers['stripe-signature'];
    const endpointSecret = envs.stripeEndpointSecret;
    let event: Stripe.Event;

    try {
        event = this.stripe.webhooks.constructEvent(req['rawBody'], signature, endpointSecret);
    } catch (error) {
        res.status(400).send(`Webhook Error: ${error.message}`);
        return;
    }

    switch (event.type) {
        case 'charge.succeeded':
          const chargeSucceded = event.data.object as Stripe.Charge;
          console.log({ orderId: chargeSucceded.metadata.orderId });
            break;
        default:
            console.log(`Unhandled event type ${event.type}`);
    }

    return res.status(200).json({ signature});
  }
}
