# Integration Notes

Paystack’s current documentation confirms that subaccounts are created with `business_name`, `bank_code`, `account_number`, and `percentage_charge`, returning a `subaccount_code`. Split payments are initialized through the transaction initialize API by passing the event’s `subaccount` code. Paystack webhooks send `charge.success` events and require HMAC-SHA512 validation of the raw payload using the secret key. Webhook handlers should acknowledge quickly with HTTP 200 responses.

Resend’s email API accepts `from`, `to`, `subject`, and either `html` or `text`, authenticated with a server-side bearer API key. The integration should fail gracefully when the optional Resend key is absent and should not prevent ticket persistence.

References:
- https://paystack.com/docs/api/subaccount/
- https://paystack.com/docs/payments/split-payments/
- https://paystack.com/docs/payments/webhooks/
- https://resend.com/docs/api-reference/emails/send-email
