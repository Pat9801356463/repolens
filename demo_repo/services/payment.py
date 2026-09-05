import stripe
from services.notifier import send_receipt


class PaymentError(Exception):
    pass


class PaymentService:
    def __init__(self, api_key):
        self.api_key = api_key

    def charge(self, amount, customer_id):
        result = self._call_stripe(amount, customer_id)
        send_receipt(customer_id, amount)
        return result

    def _call_stripe(self, amount, customer_id):
        return stripe.Charge.create(amount=amount, customer=customer_id)


def process_payment(order):
    service = PaymentService(api_key="secret")
    return service.charge(order.amount, order.customer_id)
