Rails.application.routes.draw do
  resources :cycle_transactions, only: [:create]
end
