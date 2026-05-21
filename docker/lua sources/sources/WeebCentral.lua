------------------------------------
-- @name    WeebCentral Scraper
-- @url     https://weebcentral.com/
-- @description Scrapes WeebCentral (a WordPress-based site) for comics, chapters, and page images.
-- @license MIT
------------------------------------

----- IMPORTS -----
Html     = require("html")
Http     = require("http")
HttpUtil = require("http_util")
Headless = require("headless")
Strings  = require("strings")
----- END IMPORTS -----

----- VARIABLES -----
Browser = Headless.browser()
Base    = "https://weebcentral.com"
----- END VARIABLES -----

----- MAIN FUNCTIONS -----

-- Searches for comics using WeebCentral's search (WordPress-style).
function SearchManga(query)
    local page = Browser:page()
    local searchURL = Base .. "/?s=" .. HttpUtil.query_escape(query)
    page:navigate(searchURL)
    page:waitLoad()
    
    local doc = Html.parse(page:html())
    local comics = {}
    
    -- Assume search results are contained in elements with class "entry"
    doc:find(".entry"):each(function(i, s)
        local title_elem = s:find("h2.entry-title a"):first()
        if title_elem then
            comics[i + 1] = {
                name = Strings.trim(title_elem:text()),
                url = title_elem:attr("href")
            }
        end
    end)
    return comics
end

-- Retrieves chapter list from a comic page on WeebCentral.
function MangaChapters(comicURL)
    local page = Browser:page()
    page:navigate(comicURL)
    page:waitLoad()
    
    local doc = Html.parse(page:html())
    local chapters = {}
    
    -- Assume chapters are listed in a container with class "chapter-list" as <a> elements.
    doc:find(".chapter-list a"):each(function(i, s)
        local name = Strings.trim(s:text():gsub("[\r\t\n]+", " "), " ") or "Untitled"
        local link = s:attr("href")
        if link then
            chapters[i + 1] = { name = name, url = link }
        end
    end)
    Reverse(chapters)
    return chapters
end

-- Retrieves page image URLs from a chapter page on WeebCentral.
function ChapterPages(chapterURL)
    local page = Browser:page()
    page:navigate(chapterURL)
    page:waitLoad()
    
    local doc = Html.parse(page:html())
    local pages = {}
    
    -- Assume chapter images are inside a container with class "chapter-content" and are <img> tags.
    doc:find(".chapter-content img"):each(function(i, s)
        local img_url = s:attr("src")
        if img_url then
            pages[i + 1] = { index = i + 1, url = img_url }
        end
    end)
    return pages
end

----- HELPERS -----
function Reverse(t)
    local n = #t
    local i = 1
    while i < n do
        t[i], t[n] = t[n], t[i]
        i = i + 1
        n = n - 1
    end
end
----- END HELPERS -----

----- EXAMPLE USAGE -----
local function main()
    print("WeebCentral Scraper Final Draft")
    local query = "Naruto"
    local comics = SearchManga(query)
    if #comics == 0 then
        print("No comics found for query: " .. query)
        return
    end
    local comic = comics[1]
    print("Found comic: " .. comic.name)
    
    local chapters = MangaChapters(comic.url)
    print("Found " .. #chapters .. " chapters.")
    
    if #chapters > 0 then
        local pages = ChapterPages(chapters[1].url)
        print("First chapter has " .. #pages .. " pages.")
    end
end

main()
