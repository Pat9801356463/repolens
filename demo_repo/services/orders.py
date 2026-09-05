from services.payment import process_payment, PaymentError
from services.notifier import send_alert


class RefundableOrder:
    def refund(self):
        send_alert("refund issued")


def create_order(order):
    try:
        process_payment(order)
    except PaymentError:
        send_alert("payment failed")
