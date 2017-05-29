class MarkdownHandler
  class << self
    def call(template)
      compiled_source = erb.call template
      "MarkdownHandler.render(begin;#{compiled_source};end)"
    end

    def render(text)
      key = cache_key text
      Rails.cache.fetch key do
        markdown.render(text).html_safe
      end
    end

    private

    def cache_key(text)
      Digest::MD5.hexdigest text
    end

    def markdown
      @markdown ||= Redcarpet::Markdown.new(HTMLWithSpecialLinks, fenced_code_blocks: true, autolink: true, space_after_headers: true)
    end

    def erb
      @erb ||= ActionView::Template.registered_template_handler(:erb)
    end
  end

  class HTMLWithPygments < Redcarpet::Render::HTML
    def block_code(code, lang)
      lang = lang && lang.split.first || "text"
      output = add_code_tags(
        Pygmentize.process(code, lang), lang
      )
    end

    def add_code_tags(code, lang)
      code = code.sub(/<pre>/,'<pre><code class="' + lang + '">')
      code = code.sub(/<\/pre>/,"</code></pre>")
    end
  end

  class HTMLWithSpecialLinks < HTMLWithPygments
    def autolink(link, link_type)
      case link_type
        when :url then url_link(link)
        when :email then email_link(link)
      end
    end

    def url_link(link)
      case link
        when /^http:\/\/youtube/ then youtube_link(link)
        else normal_link(link)
      end
    end

    def youtube_link(link)
      parameters_start = link.index('?')
      video_id = link[15..(parameters_start ? parameters_start-1 : -1)]
      "<div class=\"vid-embed\"><iframe width=\"560\" height=\"315\" src=\"//www.youtube.com/embed/#{video_id}?rel=0\" frameborder=\"0\" allowfullscreen></iframe></div>"
    end

    def normal_link(link)
      "<a href=\"#{link}\">#{link}</a>"
    end

    def email_link(email)
      "<a href=\"mailto:#{email}\">#{email}</a>"
    end
  end
end
