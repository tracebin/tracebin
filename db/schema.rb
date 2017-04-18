# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# Note that this schema.rb definition is the authoritative source for your
# database schema. If you need to create the application database on another
# system, you should be using db:schema:load, not running all the migrations
# from scratch. The latter is a flawed and unsustainable approach (the more migrations
# you'll amass, the slower it'll run and the greater likelihood for issues).
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema.define(version: 20170418141252) do

  # These are extensions that must be enabled in order to support this database
  enable_extension "plpgsql"

  create_table "app_bins", force: :cascade do |t|
    t.string   "app_key"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["app_key"], name: "index_app_bins_on_app_key", using: :btree
  end

  create_table "cycle_transactions", force: :cascade do |t|
    t.string   "transaction_type"
    t.string   "name"
    t.datetime "start"
    t.datetime "stop"
    t.decimal  "duration"
    t.jsonb    "events"
    t.datetime "created_at",       null: false
    t.datetime "updated_at",       null: false
    t.integer  "app_bin_id"
    t.index ["app_bin_id"], name: "index_cycle_transactions_on_app_bin_id", using: :btree
    t.index ["start"], name: "index_cycle_transactions_on_start", using: :btree
    t.index ["transaction_type"], name: "index_cycle_transactions_on_transaction_type", using: :btree
  end

  create_table "system_health_samples", force: :cascade do |t|
    t.datetime "sampled_at"
    t.jsonb    "metrics"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.integer  "app_bin_id"
    t.index ["app_bin_id"], name: "index_system_health_samples_on_app_bin_id", using: :btree
  end

# Could not dump table "transaction_events" because of following StandardError
#   Unknown type 'transaction_event_type' for column 'event_type'

  add_foreign_key "cycle_transactions", "app_bins"
  add_foreign_key "system_health_samples", "app_bins"
end
