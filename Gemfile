source 'https://rubygems.org'

git_source(:github) do |repo_name|
  repo_name = "#{repo_name}/#{repo_name}" unless repo_name.include?("/")
  "https://github.com/#{repo_name}.git"
end

# Bundle edge Rails instead: gem 'rails', github: 'rails/rails'
gem 'rails', '~> 5.0.1'
gem 'pg', '~> 0.18'
gem 'puma', '~> 3.0'
gem 'sidekiq', '~> 4.2'

gem 'haml'
gem 'sass-rails', '~> 5.0'
gem 'uglifier', '>= 1.3.0'
gem 'coffee-rails', '~> 4.2'
gem 'jquery-rails'
gem 'turbolinks', '~> 5'

source 'https://rails-assets.org' do
  gem 'rails-assets-bootstrap', '~>3.3.7'
  gem 'rails-assets-datatables.net'
  gem 'rails-assets-datatables.net-dt'
  gem 'rails-assets-datatables.net-bs'
  gem 'rails-assets-retinajs'
end

gem 'jbuilder', '~> 2.5'
gem 'redis', '~> 3.0'
gem 'figaro'
gem 'redcarpet'
gem 'pygmentize'
# gem 'tracebin'
# gem 'bcrypt', '~> 3.1.7'

group :development, :test do
  gem 'pry'
  gem 'byebug', platform: :mri
end

group :development do
  gem 'capistrano', require: false
  gem 'capistrano-rails', require: false
  gem 'capistrano-passenger', require: false
  gem 'capistrano-rbenv', require: false
  gem 'capistrano3-puma', require: false
  gem 'capistrano-sidekiq', require: false
  gem 'capistrano-figaro-yml', require: false

  gem 'web-console', '>= 3.3.0'
  gem 'listen', '~> 3.0.5'
  gem 'spring'
  gem 'spring-watcher-listen', '~> 2.0.0'
end

gem 'tzinfo-data', platforms: [:mingw, :mswin, :x64_mingw, :jruby]
