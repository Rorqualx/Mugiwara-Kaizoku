------------------------------------
-- @name    GetComics Scraper
-- @url     https://getcomics.org/
-- @description Scrapes GetComics for comics, chapters, and chapter page images.
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
Base    = "https://getcomics.org"
----- END VARIABLES -----

----- MAIN FUNCTIONS -----

-- Searches for comics on GetComics using the query.
function SearchManga(query)
    local page = Browser:page()
    local searchURL = Base .. "/search?q=" .. HttpUtil.query_escape(query)
    page:navigate(searchURL)
    page:waitLoad()
    
    local doc = Html.parse(page:html())
    local comics = {}
    
    -- Assume search results are in elements with class "comic-item"
    doc:find(".comic-item"):each(function(i, s)
        local title_elem = s:find(".title"):first()
        local link_elem = s:find("a"):first()
        if title_elem and link_elem then
            comics[i + 1] = {
                name = Strings.trim(title_elem:text()),
                url = Base .. link_elem:attr("href")
            }
        end
    end)
    return comics
end

-- Retrieves chapter list from a GetComics comic page.
function MangaChapters(mangaURL)
    local page = Browser:page()
    page:navigate(mangaURL)
    page:waitLoad()
    
    local doc = Html.parse(page:html())
    local chapters = {}
    
    -- Assume chapters are in elements with class "chapter-link"
    doc:find(".chapter-link"):each(function(i, s)
        local name = Strings.trim(s:text():gsub("[\r\t\n]+", " "), " ") or "Untitled"
        local link = s:attr("href")
        if link then
            chapters[i + 1] = { name = name, url = Base .. link }
        end
    end)
    Reverse(chapters)
    return chapters
end

-- Retrieves chapter page image URLs from a GetComics chapter page.
function ChapterPages(chapterURL)
    local page = Browser:page()
    page:navigate(chapterURL)
    page:waitLoad()
    
    local doc = Html.parse(page:html())
    local pages = {}
    
    -- Assume images are in a container with class "page-container" within <img> tags.
    doc:find(".page-container img"):each(function(i, s)
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
    print("GetComics Scraper Final Draft")
    local query = "Spider-Man"
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
