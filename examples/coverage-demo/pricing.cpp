#include "pricing.h"

int discountedPrice(int price, int quantity, bool member) {
    if (price < 0 || quantity < 0) {
        return 0;
    }
    int subtotal = price * quantity;
    if (quantity >= 5) {
        subtotal = subtotal * 90 / 100;
    }
    if (member) {
        subtotal = subtotal * 95 / 100;
    }
    return subtotal;
}

int shippingCost(int subtotal, bool express) {
    if (express) {
        return 15;
    }
    if (subtotal >= 100) {
        return 0;
    }
    return 5;
}
