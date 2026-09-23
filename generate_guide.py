#!/usr/bin/env python3
"""
Generate a beginner-friendly PDF installation guide for AirShare (Xender).

Based on the project's README.md. Designed for total beginners /
non-technical people. Uses fpdf2 (pip install fpdf2).
"""

import datetime
from fpdf import FPDF
from fpdf.enums import MethodReturnValue

# ----------------------------------------------------------------------------
# Design constants
# ----------------------------------------------------------------------------
PAGE_W = 210  # A4 width mm
PAGE_H = 297  # A4 height mm
MARGIN = 20

DARK = (15, 23, 42)        # slate-900
BODY = (30, 41, 59)        # slate-800
MUTED = (100, 116, 139)    # slate-500
ACCENT = (13, 148, 136)    # teal-600
ACCENT_LIGHT = (236, 253, 245)
WARN_BG = (254, 243, 199)
WARN_EDGE = (180, 83, 9)
NOTE_BG = (239, 246, 255)
NOTE_EDGE = (37, 99, 235)
CODE_BG = (15, 23, 42)
CODE_TEXT = (241, 245, 249)
ALT_ROW = (241, 245, 249)


class GuidePDF(FPDF):
    def footer(self):
        if self.page_no() == 1:
            return
        self.set_y(-15)
        w = self.w - self.l_margin - self.r_margin
        self.set_font("Helvetica", "", 8.5)
        self.set_text_color(*MUTED)
        self.cell(w / 2, 10, "AirShare - Beginner's Installation Guide")
        self.cell(w / 2, 10, f"Page {self.page_no()}", align="R")


def ensure_space(pdf, needed):
    """Add a page if there is not enough room left for `needed` mm."""
    if pdf.get_y() + needed > pdf.page_break_trigger - 6:
        pdf.add_page()


def h1(pdf, text):
    pdf.set_x(pdf.l_margin)
    ensure_space(pdf, 26)
    pdf.ln(4)
    pdf.set_font("Helvetica", "B", 16)
    pdf.set_text_color(*DARK)
    pdf.multi_cell(0, 9, text)
    y = pdf.get_y()
    pdf.set_draw_color(*ACCENT)
    pdf.set_line_width(0.9)
    pdf.line(pdf.l_margin, y, pdf.w - pdf.r_margin, y)
    pdf.set_line_width(0.2)
    pdf.ln(4)


def h2(pdf, text):
    pdf.set_x(pdf.l_margin)
    ensure_space(pdf, 16)
    pdf.ln(2)
    pdf.set_font("Helvetica", "B", 12.5)
    pdf.set_text_color(*DARK)
    pdf.multi_cell(0, 7, text)
    pdf.ln(1)


def para(pdf, text):
    pdf.set_x(pdf.l_margin)
    pdf.set_font("Helvetica", "", 10.5)
    pdf.set_text_color(*BODY)
    pdf.multi_cell(0, 5.6, text)
    pdf.ln(1.2)


def lead(pdf, text):
    """A slightly larger intro paragraph."""
    pdf.set_x(pdf.l_margin)
    pdf.set_font("Helvetica", "", 11.5)
    pdf.set_text_color(*DARK)
    pdf.multi_cell(0, 6.2, text)
    pdf.ln(1.5)


def bullet(pdf, text, marker="-"):
    pdf.set_x(pdf.l_margin)
    pdf.set_font("Helvetica", "", 10.5)
    pdf.set_text_color(*BODY)
    indent = 7
    mw = pdf.get_string_width(marker) + 3.5
    pdf.set_x(pdf.l_margin + indent)
    pdf.cell(mw, 5.6, marker)
    pdf.multi_cell(0, 5.6, text)
    pdf.ln(0.6)


def numbered(pdf, num, text):
    pdf.set_x(pdf.l_margin)
    pdf.set_font("Helvetica", "", 10.5)
    pdf.set_text_color(*BODY)
    indent = 7
    mw = pdf.get_string_width(f"{num}.") + 4
    pdf.set_x(pdf.l_margin + indent)
    pdf.cell(mw, 5.6, f"{num}.")
    pdf.multi_cell(0, 5.6, text)
    pdf.ln(0.6)


def code_block(pdf, code, caption=None):
    pdf.set_x(pdf.l_margin)
    lines = code.strip("\n").split("\n")
    line_h = 6.0
    pad = 4.5
    h = len(lines) * line_h + pad * 2
    if caption:
        pdf.set_font("Helvetica", "BI", 9)
        pdf.set_text_color(*MUTED)
        pdf.multi_cell(0, 5, caption)
        pdf.ln(1)
    ensure_space(pdf, h + 4)
    x = pdf.l_margin
    y = pdf.get_y()
    w = pdf.w - pdf.l_margin - pdf.r_margin
    pdf.set_fill_color(*CODE_BG)
    pdf.rect(x, y, w, h, style="F")
    pdf.set_font("Courier", "", 10.5)
    pdf.set_text_color(*CODE_TEXT)
    cy = y + pad
    for line in lines:
        pdf.set_xy(x + pad, cy)
        pdf.cell(w - 2 * pad, line_h, line)
        cy += line_h
    pdf.set_y(y + h + 3)


def info_box(pdf, title, body, kind="tip"):
    fills = {
        "tip": (236, 253, 245),
        "warn": WARN_BG,
        "note": NOTE_BG,
    }
    edges = {
        "tip": (5, 150, 105),
        "warn": WARN_EDGE,
        "note": NOTE_EDGE,
    }
    x = pdf.l_margin
    w = pdf.w - pdf.l_margin - pdf.r_margin
    pad = 5
    line_h = 5.4
    title_h = 6.5
    body_lines = pdf.multi_cell(w - 2 * pad, line_h, body,
                                dry_run=True, output=MethodReturnValue.LINES)
    h = title_h + len(body_lines) * line_h + pad * 2 + 1
    ensure_space(pdf, h + 4)
    y = pdf.get_y()
    pdf.set_fill_color(*fills[kind])
    pdf.set_draw_color(*edges[kind])
    pdf.set_line_width(0.6)
    pdf.rect(x, y, w, h, style="DF")
    pdf.set_xy(x + pad, y + pad)
    pdf.set_font("Helvetica", "B", 10.5)
    pdf.set_text_color(*edges[kind])
    pdf.cell(w - 2 * pad, title_h, title)
    pdf.set_xy(x + pad, y + pad + title_h + 1)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(*BODY)
    pdf.multi_cell(w - 2 * pad, line_h, body)
    pdf.set_y(y + h + 4)
    pdf.set_x(pdf.l_margin)
    pdf.set_line_width(0.2)


def table(pdf, headers, rows, widths, font_size=9.5):
    line_h = 5.0
    pad = 3
    x = pdf.l_margin
    w = pdf.w - pdf.l_margin - pdf.r_margin
    total = sum(widths)
    # scale widths to fit
    scale = w / total
    widths = [wd * scale for wd in widths]

    # header row
    ensure_space(pdf, 14)
    pdf.set_font("Helvetica", "B", font_size)
    pdf.set_fill_color(*DARK)
    pdf.set_text_color(255, 255, 255)
    y = pdf.get_y()
    for i, htxt in enumerate(headers):
        pdf.set_xy(x + sum(widths[:i]), y)
        pdf.cell(widths[i], 7, htxt, fill=True)
    pdf.set_y(y + 7)

    # body rows
    for ridx, row in enumerate(rows):
        # compute needed height for this row
        pdf.set_font("Helvetica", "", font_size)
        max_lines = 1
        for i, cell_text in enumerate(row):
            lines = pdf.multi_cell(widths[i] - 2 * pad, line_h, str(cell_text),
                                   dry_run=True, output=MethodReturnValue.LINES)
            max_lines = max(max_lines, len(lines))
        row_h = max_lines * line_h + 2 * pad
        ensure_space(pdf, row_h + 2)
        y = pdf.get_y()
        if ridx % 2 == 1:
            pdf.set_fill_color(*ALT_ROW)
        else:
            pdf.set_fill_color(255, 255, 255)
        pdf.set_draw_color(203, 213, 225)
        for i, cell_text in enumerate(row):
            cx = x + sum(widths[:i])
            pdf.set_xy(cx, y)
            pdf.rect(cx, y, widths[i], row_h, style="DF")
            pdf.set_xy(cx + pad, y + pad)
            pdf.set_text_color(*BODY)
            pdf.multi_cell(widths[i] - 2 * pad, line_h, str(cell_text))
        pdf.set_y(y + row_h)
    pdf.set_x(pdf.l_margin)
    pdf.ln(3)


def toc_line(pdf, num, title, page):
    pdf.set_font("Helvetica", "", 10.5)
    pdf.set_text_color(*BODY)
    w = pdf.w - pdf.l_margin - pdf.r_margin
    title_w = pdf.get_string_width(title)
    num_w = pdf.get_string_width(f"{num}  ") + 4
    dots_w = w - title_w - num_w - 12
    dots = "." * max(int(dots_w / pdf.get_string_width(".")), 1)
    pdf.set_x(pdf.l_margin)
    pdf.cell(num_w, 6.5, f"{num}  ")
    pdf.cell(title_w, 6.5, title)
    pdf.cell(dots_w, 6.5, dots)
    pdf.cell(12, 6.5, str(page), align="R")
    pdf.ln(6.5)


# ----------------------------------------------------------------------------
# Content
# ----------------------------------------------------------------------------
TOC = []


def render_title_page(pdf):
    pdf.add_page()
    # dark band
    band_h = 78
    pdf.set_fill_color(*DARK)
    pdf.rect(0, 0, PAGE_W, band_h, style="F")
    # accent strip
    pdf.set_fill_color(*ACCENT)
    pdf.rect(0, band_h, PAGE_W, 2.5, style="F")

    pdf.set_y(34)
    pdf.set_font("Helvetica", "", 13)
    pdf.set_text_color(94, 234, 212)
    pdf.cell(0, 8, "A BEGINNER'S GUIDE TO INSTALLING", align="C")
    pdf.ln(14)
    pdf.set_font("Helvetica", "B", 40)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(0, 16, "AirShare", align="C")
    pdf.ln(17)
    pdf.set_font("Helvetica", "", 13)
    pdf.set_text_color(203, 213, 225)
    pdf.cell(0, 8, "High-Speed Local File Transfer", align="C")

    pdf.set_y(band_h + 28)
    pdf.set_font("Helvetica", "", 12.5)
    pdf.set_text_color(*BODY)
    pdf.cell(0, 8, "Simple, step-by-step instructions", align="C")
    pdf.ln(9)
    pdf.set_font("Helvetica", "", 11)
    pdf.set_text_color(*MUTED)
    pdf.cell(0, 7, "Written for people who have never done this before.", align="C")

    pdf.set_y(band_h + 72)
    pdf.set_font("Helvetica", "", 10.5)
    pdf.set_text_color(*MUTED)
    pdf.cell(0, 6, "Time needed: about 15-30 minutes", align="C")
    pdf.ln(8)
    pdf.cell(0, 6, "Skill level: none required", align="C")
    pdf.ln(8)
    today = datetime.date.today().strftime("%B %d, %Y")
    pdf.cell(0, 6, f"Version: based on the project README  |  {today}", align="C")


def render_toc(pdf, toc):
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 18)
    pdf.set_text_color(*DARK)
    pdf.cell(0, 10, "Contents")
    pdf.ln(4)
    pdf.set_draw_color(*ACCENT)
    pdf.set_line_width(0.8)
    pdf.line(pdf.l_margin, pdf.get_y(), pdf.w - pdf.r_margin, pdf.get_y())
    pdf.set_line_width(0.2)
    pdf.ln(6)
    for i, (title, page) in enumerate(toc, start=1):
        toc_line(pdf, i, title, page)


def build(pdf, toc=None):
    render_title_page(pdf)
    if toc is not None:
        render_toc(pdf, toc)

    # --------------------------------------------------------------
    # 1. About this guide
    # --------------------------------------------------------------
    h1(pdf, "1.  About This Guide")
    lead(pdf, "This guide shows you, step by step, how to install and run AirShare on "
              "your own computer - even if you have never installed a program from a "
              "terminal before. Take your time, follow the steps in order, and you "
              "will be sharing files between your phone and your PC before you know it.")
    para(pdf, "AirShare is a small program that runs on your PC and lets you send photos, "
              "videos, documents, and text between your computer and your phone - extremely "
              "fast, completely through your home Wi-Fi, with no cloud services and no cables.")
    h2(pdf, "How to use this guide")
    bullet(pdf, "Read the sections in order the first time you set things up.")
    bullet(pdf, "Everything you need to TYPE is shown in a dark box like the one below. "
                "Type it exactly, then press the Enter key on your keyboard.")
    code_block(pdf, "node -v")
    bullet(pdf, "Words you may not know are explained in plain English in the "
                "Glossary at the end of this guide.")
    info_box(pdf, "TIP - Don't worry about breaking anything",
             "Almost everything we do in this guide can be undone or redone easily. "
             "If something goes wrong, you can simply start the section again.")

    # --------------------------------------------------------------
    # 2. What is AirShare?
    # --------------------------------------------------------------
    h1(pdf, "2.  What Is AirShare?")
    para(pdf, "AirShare is a free tool that runs inside your web browser, right on your "
              "home network. Your PC becomes a private little \"file hub\". Your phone "
              "connects to it - usually just by scanning a QR code - and then you can:")
    bullet(pdf, "Send videos, photos, and documents from your phone to your PC.")
    bullet(pdf, "Send files from your PC to your phone by dragging and dropping them, "
                "or just by copying and pasting (Ctrl+C / Ctrl+V).")
    bullet(pdf, "Share a common clipboard: copy text or a web link on one device and "
                "paste it on the other.")
    bullet(pdf, "See live progress with speed and time remaining while big files transfer.")
    para(pdf, "Because everything stays on your own Wi-Fi network, transfers are fast "
              "(often 30-90 MB/s or more) and nothing is uploaded to the internet.")
    h2(pdf, "What you need before you start")
    table(pdf,
          ["What", "Why you need it"],
          [["A Windows PC (Windows 10 or 11 is best)",
             "This is where AirShare will run."],
           ["A phone (iPhone or Android)",
             "This is the device you will share files with."],
           ["Both devices on the SAME Wi-Fi network",
             "AirShare works over your home network, so both devices must be "
             "connected to the same router."],
           ["Internet connection for the first setup",
             "You will download Node.js, the AirShare files, and some smaller "
             "pieces (\"dependencies\"). After that, AirShare works offline."]],
          [70, 100])
    info_box(pdf, "IMPORTANT - Why do I need to install Node.js?",
             "AirShare is built with a technology called Node.js. Node.js is like an "
             "engine that makes the program run. You only need to install it once - "
             "after that, every app built with Node.js (including AirShare) can run "
             "on your PC.", kind="note")

    # --------------------------------------------------------------
    # 3. The big picture
    # --------------------------------------------------------------
    h1(pdf, "3.  The Big Picture - What We Are About to Do")
    para(pdf, "Installing AirShare is a short recipe. Here is the whole plan before we "
              "start cooking, so nothing feels scary or random:")
    numbered(pdf, 1, "Install Node.js (the engine) - once, forever.")
    numbered(pdf, 2, "Open the terminal (a window where you type commands).")
    numbered(pdf, 3, "Download the AirShare files onto your PC.")
    numbered(pdf, 4, "Go into the AirShare folder in the terminal.")
    numbered(pdf, 5, "Install the small helper pieces with one command (npm install).")
    numbered(pdf, 6, "Start AirShare (npm start).")
    numbered(pdf, 7, "Connect your phone and share files.")
    info_box(pdf, "TIP - There is an even easier way",
             "If you just want to try AirShare quickly, you can jump straight to "
             "Part 6 and double-click the file named run.bat instead of typing "
             "commands - but only after Node.js is installed (Part 1).")

    # --------------------------------------------------------------
    # Part 1 - Node.js
    # --------------------------------------------------------------
    h1(pdf, "4.  Part 1 - Install Node.js (the Engine)")
    para(pdf, "Node.js is a free program made by a large community of developers. "
              "It is what lets AirShare actually run on your PC. Installing it is a "
              "normal Windows installer, exactly like installing any other program - "
              "you just click Next a few times.")
    h2(pdf, "Step 1.1 - Download Node.js")
    numbered(pdf, 1, "Open your web browser (Edge, Chrome, or Firefox).")
    numbered(pdf, 2, "Go to this website: https://nodejs.org")
    numbered(pdf, 3, "You will see two big download buttons. Click the one on the LEFT "
                     "labeled \"LTS\". (LTS stands for Long-Term Support - it is the safe, "
                     "recommended version.)")
    numbered(pdf, 4, "The download starts automatically. Wait until the file finishes "
                     "downloading. The file is usually named something like "
                     "\"node-v20.x.x-x64.msi\" and is found in your Downloads folder.")
    info_box(pdf, "IMPORTANT - Which version of Node.js?",
             "AirShare needs Node.js version 18 or newer. The LTS version you are "
             "about to download is always well above 18, so there is nothing extra "
             "to choose - any current LTS works perfectly.", kind="note")
    info_box(pdf, "TIP - What if I have a Mac?",
             "AirShare is designed for Windows, but the same steps work on macOS with "
             "small differences (the terminal app is called \"Terminal\"). This guide "
             "focuses on Windows to keep things simple.", kind="note")
    h2(pdf, "Step 1.2 - Run the installer")
    numbered(pdf, 1, "Open your Downloads folder (click the folder icon on the taskbar, "
                     "then choose Downloads on the left).")
    numbered(pdf, 2, "Double-click the Node.js file you just downloaded.")
    numbered(pdf, 3, "If Windows shows a blue \"User Account Control\" popup asking "
                     "\"Do you want to allow this app to make changes?\", click Yes.")
    numbered(pdf, 4, "The installer opens. Click Next through the first screens. Keep "
                     "all the standard choices - do not change anything.")
    numbered(pdf, 5, "When you see a big button that says \"Install\", click it and wait "
                     "for the green checkmark screen. Then click Finish.")
    info_box(pdf, "IMPORTANT - Restart after installing",
             "To be safe, close all programs and restart your PC once before continuing. "
             "This makes sure Windows fully recognizes the new installation.",
             kind="warn")
    h2(pdf, "Step 1.3 - Check that Node.js is installed")
    numbered(pdf, 1, "Open the terminal (the next part of this guide shows you how).")
    numbered(pdf, 2, "Type this exact line and press Enter:")
    code_block(pdf, "node -v")
    numbered(pdf, 3, "Type this exact line and press Enter:")
    code_block(pdf, "npm -v")
    para(pdf, "If you see a number like \"v20.19.0\" (any v-number is fine) after each "
              "command, Node.js is installed correctly and you can move on. If you see "
              "\"not recognized\" or an error instead, restart your PC, open a new "
              "terminal window, and try again - or see the Troubleshooting section.")
    info_box(pdf, "TIP - What is that -v?",
             "The \"-v\" simply means \"version\". Telling the computer to show its "
             "version is a handy way to confirm a program is installed.")

    # --------------------------------------------------------------
    # Part 2 - Terminal
    # --------------------------------------------------------------
    h1(pdf, "5.  Part 2 - Open the Terminal (Command Line)")
    para(pdf, "The terminal (also called \"Command Prompt\", \"PowerShell\", or "
              "\"Windows Terminal\") is a window where you give your PC instructions by "
              "typing words instead of clicking. It may look a little old-fashioned, "
              "but it is very powerful and easy once you know a few lines.")
    h2(pdf, "Step 2.1 - Open it on Windows")
    numbered(pdf, 1, "Press the Windows key on your keyboard (the key with the Windows "
                     "logo).")
    numbered(pdf, 2, "Type the word:  terminal")
    numbered(pdf, 3, "Click the app called \"Terminal\" (or \"Windows Terminal\"). "
                     "You can also use \"Command Prompt\" or \"PowerShell\" - they all "
                     "work for this guide.")
    numbered(pdf, 4, "A dark (or white) window opens with a blinking cursor. This is "
                     "your terminal.")
    info_box(pdf, "TIP - A quick shortcut",
             "You can also press and hold Shift, right-click on your desktop, and "
             "choose \"Open in Terminal\". The terminal will then open already "
             "pointed at your desktop folder.")
    h2(pdf, "Step 2.2 - What you are looking at")
    para(pdf, "The terminal shows a \"prompt\" - a short line ending with a blinking "
              "cursor, waiting for your command. On Windows it looks something like:")
    code_block(pdf, "PS C:\\Users\\YourName> _")
    para(pdf, "The \"PS C:\\...\" part simply tells you which folder the terminal is "
              "currently looking at. When you type a command and press Enter, the "
              "computer does what you asked and then shows a new prompt when it is "
              "ready for the next instruction.")

    # --------------------------------------------------------------
    # Part 3 - Get the files
    # --------------------------------------------------------------
    h1(pdf, "6.  Part 3 - Download the AirShare Files")
    para(pdf, "Next, you need to get a copy of the AirShare program onto your PC. "
              "There are two ways. If this is your first time, Option A (the ZIP file) "
              "is the easiest. Option B uses Git and is the way developers usually do it.")
    h2(pdf, "Option A - Download as a ZIP file (easiest)")
    numbered(pdf, 1, "Go to the AirShare page on GitHub in your browser.")
    numbered(pdf, 2, "Click the green button labeled \"Code\".")
    numbered(pdf, 3, "Click \"Download ZIP\" in the little menu that appears.")
    numbered(pdf, 4, "Open your Downloads folder. You will see a file called something "
                     "like \"airshare-main.zip\".")
    numbered(pdf, 5, "Right-click the ZIP file and choose \"Extract All...\".")
    numbered(pdf, 6, "Click Extract. You now have a normal folder with the AirShare "
                     "program inside.")
    numbered(pdf, 7, "Move that folder somewhere easy to find, such as your Documents "
                     "folder. You can copy (Ctrl+C) and paste (Ctrl+V) the whole folder "
                     "like any other file.")
    info_box(pdf, "TIP - The folder name does not matter",
             "In this project the folder is called Xender (you may see xender-main, "
             "airshare-main, or similar). Any name is fine - what matters is that "
             "when you open it you can see the files package.json, server.js, and "
             "run.bat inside.")
    h2(pdf, "Option B - Clone the repository with Git")
    para(pdf, "Git is a free tool developers use to download and update project files. "
              "It is not required for AirShare, but it is worth having if you plan to "
              "keep the program up to date.")
    numbered(pdf, 1, "Install Git from https://git-scm.com - download the Windows "
                     "version and click Next through the installer (keep all defaults).")
    numbered(pdf, 2, "Restart your PC or open a new terminal so it picks up Git.")
    numbered(pdf, 3, "On the AirShare GitHub page, click the green \"Code\" button and "
                     "copy the web address it shows (it looks like "
                     "https://github.com/YourName/airship.git - but use the real one "
                     "for AirShare).")
    numbered(pdf, 4, "In the terminal, type the word clone after git and paste the "
                     "address, then press Enter:")
    code_block(pdf, "git clone https://github.com/YourName/airship.git")
    para(pdf, "Git will download a folder with the same name as the project into your "
              "current folder. This is exactly the same program you would get with the "
              "ZIP file.")
    info_box(pdf, "TIP - Which one should I pick?",
             "Choose the ZIP method if you just want AirShare to work. Choose Git if "
             "you want to get updates later with a simple \"git pull\" command.")

    # --------------------------------------------------------------
    # Part 4 - Navigate
    # --------------------------------------------------------------
    h1(pdf, "7.  Part 4 - Go Into the AirShare Folder")
    para(pdf, "Now you need to tell the terminal where the AirShare folder is. The "
              "command for this is cd (short for \"change directory\"). \"Directory\" "
              "is just another word for folder.")
    h2(pdf, "Step 4.1 - Find the folder's path")
    numbered(pdf, 1, "Open File Explorer (the folder icon on your taskbar).")
    numbered(pdf, 2, "Go to the folder where you placed AirShare (for example "
                     "Documents > airshare-main).")
    numbered(pdf, 3, "Click once inside the address bar at the top of the window. The "
                     "full path (like C:\\Users\\YourName\\Documents\\airshare-main) "
                     "gets highlighted. Press Ctrl+C to copy it.")
    h2(pdf, "Step 4.2 - Type the command")
    numbered(pdf, 1, "Back in the terminal, type:  cd  followed by a space.")
    numbered(pdf, 2, "Right-click (or press Ctrl+V) to paste the path you copied.")
    numbered(pdf, 3, "Press Enter.")
    code_block(pdf, "cd C:\\Users\\YourName\\Documents\\airshare-main")
    numbered(pdf, 4, "The prompt should now change to show that folder path. That "
                     "means the terminal is now \"inside\" the AirShare folder.")
    para(pdf, "Quick check: type the word dir (or ls on a Mac) and press Enter. You "
              "should see files such as package.json, server.js, and run.bat listed. "
              "If you see those, you are definitely in the right place - regardless "
              "of what the folder is called.")
    info_box(pdf, "TIP - Fast way to open the terminal in the folder",
             "Open the AirShare (Xender) folder in File Explorer, then click in the "
             "address bar, type cmd, and press Enter. A terminal opens that is "
             "already in the right folder - no cd needed at all!")

    # --------------------------------------------------------------
    # Part 5 - npm install
    # --------------------------------------------------------------
    h1(pdf, "8.  Part 5 - Install the Dependencies (npm install)")
    para(pdf, "AirShare needs a few small helper libraries to run (they handle the web "
              "server, file uploads, QR codes, and live progress). npm is a program "
              "that downloads and installs these helpers for you automatically. "
              "\"npm\" stands for \"Node Package Manager\" - it came with Node.js in "
              "Part 1.")
    numbered(pdf, 1, "Make sure the terminal is inside the AirShare folder (see Part 4).")
    numbered(pdf, 2, "Type this command and press Enter:")
    code_block(pdf, "npm install")
    para(pdf, "What should happen: the terminal will show a list of package names "
              "flying by, and a little progress bar may appear. This can take a few "
              "minutes the first time - that is normal. When it finishes, you get your "
              "prompt back and you will see a new folder named node_modules appear "
              "inside the AirShare folder. That folder is where all the helpers live. "
              "Leave it alone - AirShare needs it.")
    info_box(pdf, "TIP - It is okay if you see warnings",
             "Sometimes npm shows yellow \"warning\" or \"deprecated\" messages. "
             "These are just friendly notices and are usually harmless. As long as the "
             "command finishes and your prompt comes back, you are fine.")
    info_box(pdf, "What if it fails?",
             "If you see a big red error, first check that you have an internet "
             "connection, then close the terminal, open a new one, navigate to the "
             "AirShare folder again, and run npm install once more. If it keeps "
             "failing, see the Troubleshooting section.", kind="warn")

    # --------------------------------------------------------------
    # Part 6 - npm start
    # --------------------------------------------------------------
    h1(pdf, "9.  Part 6 - Start AirShare")
    numbered(pdf, 1, "In the terminal, type this command and press Enter:")
    code_block(pdf, "npm start")
    numbered(pdf, 2, "Within a few seconds you will see a QR code drawn out of "
                     "characters in the terminal, and your web browser should open "
                     "automatically to http://localhost:3000")
    numbered(pdf, 3, "Leave the terminal window OPEN. Closing it stops AirShare.")
    para(pdf, "Your browser now shows the AirShare portal - a clean page where you can "
              "drag and drop files. Congratulations: AirShare is running on your PC!")
    h2(pdf, "The no-typing way: double-click run.bat")
    para(pdf, "The project folder includes a file called run.bat. Double-clicking it "
              "starts AirShare without opening a terminal or typing anything. It does "
              "exactly the same thing as npm start.")
    numbered(pdf, 1, "Open the AirShare folder in File Explorer.")
    numbered(pdf, 2, "Double-click run.bat (if Windows asks, click \"More info\" and "
                     "then \"Run anyway\").")
    numbered(pdf, 3, "A terminal window opens, shows the QR code, and your browser "
                     "opens the AirShare page. Done!")
    info_box(pdf, "TIP - What is \"localhost\"?",
             "http://localhost:3000 simply means \"this computer, port 3000\". Port "
             "3000 is the little door AirShare listens on. You never need to change "
             "this - it just tells your browser where the program is.")

    # --------------------------------------------------------------
    # Part 7 - Connect phone
    # --------------------------------------------------------------
    h1(pdf, "10.  Part 7 - Connect Your Phone")
    para(pdf, "Your PC is now the hub. To join your phone, both devices must be on "
              "the SAME Wi-Fi network (not mobile data, and not two different "
              "networks like a guest Wi-Fi).")
    numbered(pdf, 1, "Make sure your phone is connected to the same Wi-Fi as your PC. "
                     "Check this in your phone's Settings > Wi-Fi.")
    numbered(pdf, 2, "On your PC, look at the QR code in the terminal (or on the "
                     "AirShare page, if it shows one there).")
    numbered(pdf, 3, "On an iPhone: open the Camera app and point it at the QR code. "
                     "A notification appears - tap it to open the AirShare page.")
    numbered(pdf, 4, "On Android: open the camera or Google Lens and point it at the "
                     "QR code, then tap the link that appears.")
    h2(pdf, "Can't scan the QR code? Type the address instead")
    para(pdf, "When AirShare starts, it shows your PC's address on your network (it "
              "usually looks like http://192.168.x.x:3000). On your phone, open any "
              "browser and type that address exactly. If you are not sure which "
              "address to use, the one your PC shows you is the right one.")
    info_box(pdf, "TIP - The first connection",
             "The first time you connect, Windows may ask if you want to allow access "
             "through the firewall. Click \"Allow access\" - otherwise your phone "
             "cannot reach AirShare.", kind="note")

    # --------------------------------------------------------------
    # Part 8 - Share files
    # --------------------------------------------------------------
    h1(pdf, "11.  Part 8 - Share Your First Files")
    h2(pdf, "Send files from your phone to your PC")
    numbered(pdf, 1, "Open the AirShare page on your phone (scan the QR code again if "
                     "the page closed).")
    numbered(pdf, 2, "Tap the drop zone (or the \"choose files\" button) and pick "
                     "photos, videos, or documents.")
    numbered(pdf, 3, "Watch the progress bar - it shows speed, percentage, and "
                     "estimated time remaining.")
    numbered(pdf, 4, "When it finishes, the file is saved in the uploads folder inside "
                     "the AirShare project folder on your PC.")
    h2(pdf, "Send files from your PC to your phone")
    numbered(pdf, 1, "On the AirShare page in your PC's browser, drag and drop a file "
                     "into the page (or click to browse).")
    numbered(pdf, 2, "You can also select a file in Windows and press Ctrl+C, then "
                     "click on the AirShare page and press Ctrl+V - the file is "
                     "uploaded instantly.")
    numbered(pdf, 3, "Open the page on your phone to download the file.")
    h2(pdf, "Share text and links (shared clipboard)")
    numbered(pdf, 1, "Type (or paste) some text in the clipboard box on either device.")
    numbered(pdf, 2, "Click \"Send to other device\".")
    numbered(pdf, 3, "Use \"Copy Text\" to silently copy it to the other device's "
                     "clipboard, and \"Clear\" to wipe the shared clipboard for everyone.")
    info_box(pdf, "TIP - Where do my files go?",
             "Files sent from your phone land in the uploads folder inside the "
             "AirShare folder. You can click \"Open folder\" on the PC page to jump "
             "straight there in File Explorer.")

    # --------------------------------------------------------------
    # Part 9 - Stop / restart
    # --------------------------------------------------------------
    h1(pdf, "12.  Part 9 - Stopping and Restarting AirShare")
    h2(pdf, "To stop AirShare")
    numbered(pdf, 1, "Go back to the terminal window that is running AirShare.")
    numbered(pdf, 2, "Press and hold the Ctrl key, then press C. (You will see "
                     "^C printed in the terminal.)")
    numbered(pdf, 3, "AirShare stops and you get your normal prompt back. You can "
                     "safely close the window now.")
    h2(pdf, "To start it again later")
    numbered(pdf, 1, "Open the AirShare folder and double-click run.bat - or open a "
                     "terminal in that folder and type npm start.")
    numbered(pdf, 2, "Wait for the QR code and browser window, then scan the code with "
                     "your phone again.")
    info_box(pdf, "NOTE - This is a local tool, not a website",
             "AirShare only runs while your PC is on and the terminal (or run.bat) is "
             "open. That is by design - it is private and offline, just for your own "
             "devices.", kind="note")

    # --------------------------------------------------------------
    # Part 10 - Shortcut
    # --------------------------------------------------------------
    h1(pdf, "13.  Part 10 (Optional) - Create a Desktop Shortcut")
    para(pdf, "If you want to launch AirShare with one double-click from your desktop - "
              "no terminal window - the project includes a small helper script called "
              "create_shortcut.ps1. It puts an \"AirShare\" shortcut on your desktop "
              "with a little network icon.")
    numbered(pdf, 1, "Open the AirShare folder in File Explorer.")
    numbered(pdf, 2, "Right-click inside the folder (on empty space) and choose "
                     "\"Open in Terminal\".")
    numbered(pdf, 3, "Type this command and press Enter:")
    code_block(pdf, "powershell -ExecutionPolicy Bypass -File create_shortcut.ps1")
    numbered(pdf, 4, "Look on your desktop for a shortcut named AirShare. Double-click "
                     "it to start the program (it runs run.bat behind the scenes).")
    numbered(pdf, 5, "Optional: drag the shortcut onto your taskbar to pin it, or "
                     "right-click it and choose \"Pin to Start\".")
    info_box(pdf, "TIP - What is \"ExecutionPolicy Bypass\"?",
             "PowerShell is extra cautious about running scripts. \"Bypass\" simply "
             "tells it: yes, I really do want to run this one script. It is completely "
             "safe for a script you downloaded with the project itself.", kind="note")

    # --------------------------------------------------------------
    # Troubleshooting
    # --------------------------------------------------------------
    h1(pdf, "14.  Troubleshooting")
    para(pdf, "If something is not working, look for your symptom below. Most "
              "problems have a very simple cause.")
    table(pdf,
          ["Problem", "Most likely cause and fix"],
          [["\"node is not recognized...\"",
             "Node.js did not install, or Windows has not noticed yet. Restart your PC, "
             "open a NEW terminal, and run node -v again. Reinstall Node.js if needed."],
           ["\"npm is not recognized...\"",
             "Same as above - restart and try again in a fresh terminal window."],
           ["npm install shows a red error",
             "Check your internet connection and try again. If it still fails, close "
             "the terminal, open a new one, cd back into the AirShare folder, and run "
             "npm install once more."],
           ["\"EADDRINUSE\" or \"port 3000 is already in use\"",
             "AirShare is probably already running in another window, or another "
             "program is using port 3000. Close the other terminal and try again."],
           ["My phone cannot connect / page never loads",
             "Both devices must be on the SAME Wi-Fi. Check your phone's Wi-Fi "
             "settings. Also make sure you clicked \"Allow access\" if Windows asked "
             "about the firewall."],
           ["The QR code will not scan",
             "Make the terminal window bigger so the QR code is larger, or type the "
             "address shown by AirShare (like http://192.168.x.x:3000) into your "
             "phone's browser."],
           ["The browser does not open automatically",
             "No problem - just open your browser and type http://localhost:3000 "
             "manually. (On Linux, this is expected; see the README.)"],
           ["Downloads seem slow",
             "Wi-Fi speed depends on your router. Move closer to the router and try "
             "again - 5GHz networks are much faster than 2.4GHz ones."],
           ["Windows \"SmartScreen\" blocks run.bat or the installer",
             "Click \"More info\", then \"Run anyway\". These files are part of the "
             "project and are safe."]],
          [60, 110])

    # --------------------------------------------------------------
    # Glossary
    # --------------------------------------------------------------
    h1(pdf, "15.  Glossary - Words Used in This Guide")
    glossary = [
        ("Terminal", "A window where you type instructions to your computer. Also "
                     "called Command Prompt, PowerShell, or console."),
        ("Command", "A line of text you type into the terminal and run with Enter."),
        ("Node.js", "A free \"engine\" that runs programs like AirShare on your PC."),
        ("npm", "A tool that comes with Node.js. It downloads and installs helper "
                "libraries (\"dependencies\") for programs."),
        ("Dependencies", "Small helper pieces of software a program needs to work. "
                         "For AirShare these are express, multer, ws, and qrcode."),
        ("Clone", "Downloading a copy of a project from GitHub using Git."),
        ("Git", "A free tool for downloading and tracking changes to software projects."),
        ("Repository (repo)", "The online home of a project's files, usually on GitHub."),
        ("Server", "A program that runs continuously and answers requests from other "
                   "devices. AirShare turns your PC into a small local server."),
        ("localhost", "A special name meaning \"this computer\". http://localhost:3000 "
                      "points to AirShare on your own PC."),
        ("Port", "A numbered \"door\" on your computer that a program listens on. "
                 "AirShare uses port 3000."),
        ("LAN", "Local Area Network - all the devices connected to your home router."),
        ("QR code", "A square black-and-white pattern your phone's camera can scan to "
                    "open a web address quickly."),
        ("Uploads folder", "The folder where files sent from your phone are saved on "
                           "your PC (inside the AirShare project folder)."),
    ]
    for term, definition in glossary:
        pdf.set_font("Helvetica", "B", 10.5)
        pdf.set_text_color(*ACCENT)
        pdf.set_x(pdf.l_margin)
        pdf.multi_cell(0, 6, term)
        pdf.set_font("Helvetica", "", 10.5)
        pdf.set_text_color(*BODY)
        pdf.set_x(pdf.l_margin)
        pdf.multi_cell(0, 5.6, definition)
        pdf.ln(2.5)

    # --------------------------------------------------------------
    # Final checklist
    # --------------------------------------------------------------
    h1(pdf, "16.  Final Checklist")
    para(pdf, "Before you finish, run through this list. If you can tick every box, "
              "your installation is complete and correct.")
    bullet(pdf, "I installed Node.js and both node -v and npm -v print a version number.")
    bullet(pdf, "I have the AirShare folder on my PC (from the ZIP or the git clone).")
    bullet(pdf, "I ran npm install and saw it finish successfully.")
    bullet(pdf, "I started AirShare with npm start (or run.bat) and the QR code appeared.")
    bullet(pdf, "My browser opened http://localhost:3000 and shows the AirShare page.")
    bullet(pdf, "My phone and PC are on the same Wi-Fi, and scanning the QR code "
                "opened the page on my phone.")
    bullet(pdf, "I sent a test file from my phone to my PC and found it in the "
                "uploads folder.")
    para(pdf, "")
    para(pdf, "You are all set. Enjoy your fast, private, offline file sharing between "
              "your phone and your PC!")


def main():
    out = "AirShare_Install_Guide_For_Beginners.pdf"

    # ----- Pass 1: build WITHOUT a TOC, recording heading pages.
    pdf = GuidePDF(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.set_margins(MARGIN, 16, MARGIN)
    pdf.set_title("AirShare - Beginner's Installation Guide")
    pdf.set_author("AirShare")

    rec = {}

    def h1_recorder(p, t):
        saved(p, t)                        # draw the heading first
        rec.setdefault(len(rec), (t, p.page_no()))  # then record where it landed

    saved = globals()["h1"]
    globals()["h1"] = h1_recorder
    build(pdf, toc=None)
    globals()["h1"] = saved

    raw_toc = [rec[i] for i in sorted(rec)]

    # ----- Measure how many pages the Contents block itself takes,
    #       so we can offset every recorded page number correctly.
    def toc_pages(entries):
        probe = GuidePDF(orientation="P", unit="mm", format="A4")
        probe.set_auto_page_break(auto=True, margin=18)
        probe.set_margins(MARGIN, 16, MARGIN)
        render_toc(probe, entries)
        return probe.pages_count

    shift = toc_pages(raw_toc)
    toc = [(title, page + shift) for (title, page) in raw_toc]

    # ----- Pass 2: rebuild with the real Table of Contents.
    pdf2 = GuidePDF(orientation="P", unit="mm", format="A4")
    pdf2.set_auto_page_break(auto=True, margin=18)
    pdf2.set_margins(MARGIN, 16, MARGIN)
    pdf2.set_title("AirShare - Beginner's Installation Guide")
    pdf2.set_author("AirShare")
    globals()["h1"] = saved
    build(pdf2, toc=toc)

    pdf2.output(out)
    print(f"Created {out} with {pdf2.pages_count} pages.")
    for t, p in toc:
        print(f"  p{p:>3}  {t}")
if __name__ == "__main__":
    main()
