------------------------------------
-- @name    ReadComicOnline Scraper
-- @url     https://readcomiconline.li/
-- @description Scrapes ReadComicOnline.li for comic search, metadata extraction, and chapter page image retrieval.
--              It exposes a unified API with three main functions:
--                  * SearchManga(query)
--                  * MangaChapters(comicURL)
--                  * ChapterPages(chapterURL)
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
Base    = "https://readcomiconline.li"
----- END VARIABLES -----

----- MAIN FUNCTIONS -----

-- Searches for comics matching the query.
-- Returns a table of comics, each with 'name' and 'url'
function SearchManga(query)
    local page = Browser:page()
    local searchURL = Base .. "/?s=" .. HttpUtil.query_escape(query)
    local ok, err = page:navigate(searchURL)
    if not ok then error("Navigation failed: " .. err) end
    page:waitLoad(5000)  -- wait up to 5 seconds for the page to load
    
    local htmlContent = page:html()
    if not htmlContent or htmlContent == "" then
        error("Empty HTML content for search page")
    end
    
    local doc = Html.parse(htmlContent)
    local comics = {}
    
    -- Assumption: each comic search result is in an element with class "comic-list-item"
    doc:find(".comic-list-item"):each(function(i, s)
        local title_elem = s:find("h3.title a"):first()
        if title_elem then
            local comic = {
                name = Strings.trim(title_elem:text()),
                url = title_elem:attr("href")
            }
            comics[i + 1] = comic
        end
    end)
    
    if #comics == 0 then
        print("Warning: No comics found for query: " .. query)
    end
    
    return comics
end

-- Retrieves comic metadata and chapter list from a comic detail page.
-- Returns a table containing:
--    title: comic title,
--    summary: comic summary (if available),
--    chapters: an array of chapter objects { name, url }
function MangaChapters(comicURL)
    local page = Browser:page()
    local ok, err = page:navigate(comicURL)
    if not ok then error("Navigation failed: " .. err) end
    page:waitLoad(5000)
    
    local htmlContent = page:html()
    if not htmlContent or htmlContent == "" then
        error("Empty HTML content for comic detail page")
    end
    
    local doc = Html.parse(htmlContent)
    local metadata = {}
    
    -- Extract comic title; adjust selector as needed
    local title_elem = doc:find(".comic-title"):first()
    metadata.title = title_elem and Strings.trim(title_elem:text()) or "Unknown Title"
    
    -- Extract comic summary; adjust selector if available
    local summary_elem = doc:find(".comic-summary"):first()
    metadata.summary = summary_elem and Strings.trim(summary_elem:text()) or "No summary available"
    
    -- Extract chapters from a container with class "chapter-list"
    local chapters = {}
    doc:find(".chapter-list a"):each(function(i, s)
        local chapterName = Strings.trim(s:text():gsub("[\r\t\n]+", " "), " ") or "Untitled"
        local link = s:attr("href")
        if link then
            chapters[i + 1] = { name = chapterName, url = link }
        end
    end)
    
    if #chapters == 0 then
        print("Warning: No chapters found for comic: " .. metadata.title)
    end
    
    Reverse(chapters)  -- Reverse the list if the chapters are in descending order.
    metadata.chapters = chapters
    
    return metadata
end

-- Retrieves the list of page image URLs for a given chapter.
-- Returns an array of pages, each with 'index' and 'url'
function ChapterPages(chapterURL)
    local page = Browser:page()
    local ok, err = page:navigate(chapterURL)
    if not ok then error("Navigation failed: " .. err) end
    page:waitLoad(5000)
    
    local htmlContent = page:html()
    if not htmlContent or htmlContent == "" then
        error("Empty HTML content for chapter page")
    end
    
    local doc = Html.parse(htmlContent)
    local pages = {}
    
    -- Assumption: chapter images are inside a container with class "chapter-pages"
    doc:find(".chapter-pages img"):each(function(i, s)
        local img_url = s:attr("src")
        if img_url then
            pages[i + 1] = { index = i + 1, url = img_url }
        end
    end)
    
    if #pages == 0 then
        print("Warning: No pages found for chapter: " .. chapterURL)
    end
    
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
    print("ReadComicOnline Scraper - Final Draft")
    local query = "Batman"  -- example search query
    local comics = SearchManga(query)
    if #comics == 0 then
        print("No comics found for query: " .. query)
        return
    end
    
    local comic = comics[1]
    print("Found comic: " .. comic.name)
    
    local metadata = MangaChapters(comic.url)
    print("Comic Title: " .. metadata.title)
    print("Summary: " .. metadata.summary)
    print("Total Chapters: " .. (#metadata.chapters))
    
    if #metadata.chapters > 0 then
        local pages = ChapterPages(metadata.chapters[1].url)
        print("First chapter has " .. #pages .. " pages.")
    else
        print("No chapters available.")
    end
end

main()
