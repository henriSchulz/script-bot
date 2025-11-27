\NeedsTeXFormat{LaTeX2e}
\RequirePackage{bm}
\ProvidesClass{kit-poster}[DT Posterzusammenfassung]


\LoadClass{article}


\RequirePackage{graphicx}
\RequirePackage{amsmath}
\RequirePackage{geometry}
\RequirePackage{xcolor}
\RequirePackage{titlesec}
\RequirePackage{multicol}
\RequirePackage{svg}
\RequirePackage[skins,breakable]{tcolorbox}
\RequirePackage{environ}

\RequirePackage{fontawesome}


\RequirePackage{tikz}
\usepackage{helvet}
\renewcommand{\familydefault}{\sfdefault}

\renewcommand{\Huge}{\fontsize{27}{40}\selectfont}

\newcommand{\boxtitle}[1]{
    \noindent
    \begin{center}
    \Large \textbf{#1}
    \end{center}
    \vspace{0.5em}
}



\NewDocumentEnvironment{pbox}{O{}}
{\begin{tcolorbox}[colframe=itiv-blue, colback=white, #1]}
{\end{tcolorbox}}

\newenvironment{doublebox}{
    \begin{multicols}{2}
    }{
    \end{multicols}
}

\newcommand{\hb}[1]{\textcolor{itiv-blue}{\textbf{#1}}}



\newenvironment{tripplebox}{
    \begin{multicols}{3}
    }{
    \end{multicols}
}

\newcommand{\disclaimer}{%
    \begin{flushright}
    \textcolor{gray}{\textit{Dieses Poster gilt als Lernhilfe und erhebt keinen Anspruch auf Vollständigkeit.}}%
    \end{flushright}
}

\tcbset{
    bigformulabox/.style={
        enhanced,
        colback=itiv-blue!30,
        colframe=itiv-blue,
        boxrule=0.3mm,
        arc=1mm,
        outer arc=1mm,
        drop shadow,
        width=\textwidth,
        left=2mm,
        right=2mm,
    }
}
\newcommand{\bigand}{\mathop{\mathchoice
  {\vcenter{\hbox{\scalebox{2.2}{$\displaystyle\&$}}}}% displaystyle
  {\vcenter{\hbox{\scalebox{1.8}{$\textstyle\&$}}}}% textstyle
  {\vcenter{\hbox{\scalebox{1.4}{$\scriptstyle\&$}}}}% scriptstyle
  {\vcenter{\hbox{\scalebox{1.0}{$\scriptscriptstyle\&$}}}}% scriptscriptstyle
}\displaylimits}

\NewDocumentCommand{\bigformula}{m}{
    \begin{center}
        \begin{tcolorbox}[bigformulabox]
            \centering
            \LARGE\bm{#1}
        \end{tcolorbox}
    \end{center}
}

\NewDocumentCommand{\book}{m}{
    \vspace{3mm}
    \small \textcolor{gray}{\faBook\ \textit{Mehr zu diesem Thema auf Seite #1}}
}


\tcbset{%
    boxtitlestuff/.style={%
    frame empty,
    colback=black!2!white,
    },
    brokentitle/.style={%
    geometry nodes=true,
    skin=freelance,
    extras first={%
        overlay={%
            \draw [preaction={draw=green!15!white, line width=1pt, rounded corners}, rounded corners, green!50!white, line width=1pt, dashed] ([yshift=1pt, xshift=-1pt]interior.north west) rectangle ([yshift=-1pt, xshift=1pt]interior.south east);
            \node[above, rounded corners, draw, green!50!white, line width=1pt, fill=green!15!white, text=green!50!black, font=\bfseries\normalsize] (A) at ([yshift=-.25\baselineskip]interior.north) {#1};
        }
    },
    extras middle and last={%
        overlay={%
            \draw [preaction={draw=green!15!white, line width=1pt, rounded corners}, rounded corners,green!50!white, line width=1pt, dashed] ([yshift=1pt, xshift=-1pt]interior.north west) rectangle ([yshift=-1pt, xshift=1pt]interior.south east);
            \node[above, rounded corners, draw=black, line width=.8pt, fill=black!2!white, text=black, font=\bfseries\normalsize] (A) at ([yshift=-.25\baselineskip]interior.north) {continued boxed title};
        }
    }
    }
}

\newcommand{\highlightbox}[1]{
    \begin{tcolorbox}[%
        brokentitle=Boxed title,
        breakable,
        frame empty,
        colframe=green!15!white,
    ]
    #1
    \end{tcolorbox}
}






\newcommand{\posterfooter}{
    \vspace{5mm}
    \begin{center}
    \begin{multicols}{3}
    \parbox{8.5cm}{
        \footnotesize
        \textcolor{gray}{
            KIT – Universität des Landes Baden-Württemberg und nationales \\Großforschungszentrum in der Helmholtz-Gemeinschaft
        }
    }

    \centering
    \footnotesize
    \textcolor{gray}{
        \begin{tabular}{c}
        Leiter:\\
        Übungsleiter: 
        \end{tabular}
    }

    \begin{flushright}
    \Huge \texttt{www.kit.edu}
    \end{flushright}

    \end{multicols}
    \end{center}
}

\newcommand{\image}[2][]{
    \begin{wrapfigure}{r}{#1}
    \centering
    \includegraphics[width=#1]{#2}
    \end{wrapfigure}
}

\newcommand{\svg}[2][]{
    \begin{wrapfigure}{r}{#1}
    \centering
    \includesvg[width=#1]{#2}
    \end{wrapfigure}
}

\newtcolorbox{posterframe}[1][]{%
    enhanced,
    colframe=gray,
    colback=white,
    boxrule=1.2pt,
    width=\textwidth,
    left=3mm,
    right=3mm,
    top=5mm,
    height=38.5cm
    #1
}

\definecolor{kit-green}{RGB}{0, 150, 130}
\definecolor{itiv-blue}{RGB}{15, 64, 139}
\geometry{a3paper, left=0.75cm, right=0.75cm, top=1cm, bottom=0cm}




\newcommand{\module}[1]{\def\@module{#1}}
\newcommand{\@module}{}


\pagenumbering{gobble}

\renewcommand{\maketitle}{
    \begin{center}

        \makebox[\textwidth][l]{
            \includesvg[height=2cm]{assets/kit-logo.svg}
            %\hspace{1cm}
            \hfill
            \raisebox{25pt}[0pt][0pt]{\parbox{20cm}{\textbf{\huge \textcolor{gray}{Elektrotechnisches Institut}}
            \hfill
            \raisebox{-20pt}[0pt][0pt]{\includesvg[height=2cm]{assets/eti-logo.svg}}
            }}}
        \vspace{1cm} \\
        {\Huge\textcolor{gray} {\textbf{\@module}}} \\[0.5cm]
        {\Huge \textbf{\@title}}
%        \vspace{0.5cm}
    \end{center}

}



\endinput
