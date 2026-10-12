#include "inventory.h"

bool canFulfil(int available, int requested) {
    if (requested <= 0) {
        return false;
    }
    if (requested > available) {
        return false;
    }
    return true;
}
