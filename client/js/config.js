// configurazione globale dell'applicazione
// riduco url a costanti riutilizzabili in tutto il codice

//se modifico l'url del server (localhost...), lo cambio qui e si aggiorna ovunque

const CONFIG = {
    //API_BASE_URL: 'http://localhost:3000', 'https://ablutionary-wilford-presusceptible.ngrok-free.dev'
    API_BASE_URL:'http://localhost:3000' ,
    ENDPOINTS: {
        // auth
        REGISTER: '/register',
        LOGIN: '/login',
        LOGOUT: '/logout',
        
        // user
        PROFILE: '/profile',
        UPDATE_USER: '/user/update',
        DELETE_USER: '/user/delete',
        
        // restaurants
        RESTAURANTS: '/restaurants',
        RESTAURANTS_DETAIL: '/restaurants/{id}',
        RESTAURANTS_CATEGORIES: '/restaurants-categories',
        
        // meals
        MEALS: '/meals',
        //MEALS_BY_RESTAURANT: '/meals/restaurant/{restaurantId}',
        MEALS_SEARCH: '/meals/search',
        MEALS_CATEGORIES: '/meals/categories',
        MEALS_BY_CATEGORY: '/meals/category/{category}',
        MEALS_RANDOM: '/meals/random',
        MEALS_DETAIL: '/meals/{id}',
        
        // menu
        MENU: '/menu',
        MENU_ADD: '/menu/add',
        MENU_UPDATE: '/menu/update/{menuItemId}',
        MENU_REMOVE: '/menu/remove/{menuItemId}',
        MENU_RESTAURANT: '/menu/restaurant/{id}',
        
        // cart
        CART: '/cart',
        CART_ADD: '/cart/add',
        CART_UPDATE: '/cart/update/{itemId}',
        CART_REMOVE: '/cart/remove/{menuItemId}',
        CART_CLEAR: '/cart/clear',
        
        // orders
        ORDERS_CREATE: '/orders/create',
        ORDERS_MINE: '/orders/mine',
        ORDERS_RESTAURANT: '/orders/restaurant',
        ORDERS_RESTAURANT_DETAIL: '/orders/restaurant/{id}',
        ORDERS_DETAIL: '/orders/{id}',
        ORDERS_STATUS: '/orders/{id}/status',
        ORDERS_CANCEL: '/orders/{id}/cancel',
        ORDERS_START_PREPARATION: '/orders/{id}/start-preparation',
        ORDERS_MARK_DELIVERED: '/orders/{id}/mark-delivered',
        
        // upload
        UPLOAD_IMAGE: '/upload/image'
    },
    
    ORDER_STATES: {
        ORDINATO: 'ordinato',
        IN_PREPARAZIONE: 'in preparazione',
        PRONTO: 'pronto',
        IN_CONSEGNA: 'in consegna',
        CONSEGNATO: 'consegnato',
        ANNULLATO: 'annullato'
    },
    
    ROLES: {
        CLIENTE: 'cliente',
        RISTORANTE: 'ristorante'
    }
};

// export per uso in altri file
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}
