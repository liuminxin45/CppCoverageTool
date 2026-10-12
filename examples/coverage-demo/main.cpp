#include "pricing.h"
#include "inventory.h"
#include <iostream>
#include <string>

int main(int argc, char** argv) {
    const bool bulkOrder = argc > 1 && std::string(argv[1]) == "bulk";
    const int quantity = bulkOrder ? 6 : 2;
    const int subtotal = discountedPrice(25, quantity, bulkOrder);
    const int shipping = shippingCost(subtotal, false);
    const bool available = canFulfil(10, quantity);
    std::cout << "Order: " << quantity << " items\n"
              << "Subtotal: " << subtotal << "\n"
              << "Shipping: " << shipping << "\n"
              << "In stock: " << available << "\n";
    return available ? 0 : 1;
}
