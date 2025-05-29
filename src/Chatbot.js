import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import "highlight.js/styles/github.css";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// Table styling objects
const tableStyle = {
  borderCollapse: "collapse",
  width: "100%",
  marginTop: "12px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
  borderRadius: "8px",
  overflow: "hidden",
};
const thStyle = {
  background: "linear-gradient(135deg, #6a82fb, #fc5c7d)",
  color: "white",
  padding: "10px 16px",
  textAlign: "left",
  fontWeight: "600",
  fontSize: "14px",
  userSelect: "none",
};
const tdStyle = {
  background: "white",
  padding: "10px 16px",
  borderBottom: "1px solid #eee",
  fontSize: "14px",
  color: "#333",
};

// Custom row component for hover effect
const TableRow = ({ children, ...props }) => {
  const [hover, setHover] = useState(false);
  return (
    <tr
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        transition: "background-color 0.3s ease",
        backgroundColor: hover ? "#f0f4ff" : "white",
      }}
      {...props}
    >
      {children}
    </tr>
  );
};

// Code block with copy button
const CodeBlock = ({ children, className }) => {
  const language = className ? className.replace("language-", "") : "plaintext";
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(children).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={{ position: "relative", borderRadius: "8px", overflow: "hidden" }}>
      <button
        onClick={handleCopy}
        style={{
          position: "absolute",
          top: "10px",
          right: "10px",
          background: copied ? "#4caf50" : "#007bff",
          color: "white",
          border: "none",
          padding: "4px 8px",
          fontSize: "12px",
          borderRadius: "4px",
          cursor: "pointer",
          transition: "background 0.3s ease",
        }}
      >
        {copied ? "Copied!" : "Copy"}
      </button>
      <SyntaxHighlighter language={language} style={oneDark}>
        {children}
      </SyntaxHighlighter>
    </div>
  );
};

const Chatbot = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatContainerRef = useRef(null);
  const textareaRef = useRef(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [input]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const newMessages = [...messages, { text: input, sender: "user" }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const apiUrl = `http://10.202.100.207:5000/query?prompt=${encodeURIComponent(input)}`;
      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const data = await response.json();
      let sqlQuery = data.sql_query || "No SQL query returned.";
      const status = data.status;

      if (status !== "success") throw new Error(data.error || "Query failed without specific error.");

      // Parse results (convert dates)
      let rawResult = data.result;
      if (typeof rawResult === "string") {
        rawResult = rawResult.replace(/datetime\.date\((\d+), (\d+), (\d+)\)/g, '"$1-$2-$3"');
        try {
          rawResult = JSON.parse(rawResult);
        } catch {
          rawResult = [[rawResult]];
        }
      }
      if (!Array.isArray(rawResult)) rawResult = [[rawResult]];
      const parsedResult = rawResult.map(row => (Array.isArray(row) ? row : [row]));

      // Extract headers robustly
      let headers = [];
      const selectMatch = sqlQuery.match(/SELECT\s+([\s\S]*?)\s+FROM/i);
      if (selectMatch && selectMatch[1]) {
        headers = selectMatch[1]
          .split(",")
          .map(h => h.trim().replace(/['`]/g, ""));
        // Handle edge case if headers is a single comma-separated string inside one element
        if (headers.length === 1 && headers[0].includes(",")) {
          headers = headers[0].split(",").map(h => h.trim());
        }
      }

      // Fallback headers if extraction failed
      if (headers.length === 0 && parsedResult.length) {
        headers = parsedResult[0].map((_, i) => `Column ${i + 1}`);
      }

      // Build markdown table
      const tableHeader = `| ${headers.map(h => `**${h}**`).join(" | ")} |`;
      const tableDivider = `| ${headers.map(() => "---").join(" | ")} |`;
      const tableRows = parsedResult
        .map(row => `| ${row.map(cell => (cell != null ? cell : "-")).join(" | ")} |`)
        .join("\n");
      const resultTable = parsedResult.length
        ? `${tableHeader}\n${tableDivider}\n${tableRows}`
        : "_No results found._";

      const botReply = `**SQL Query:**\n\n\`\`\`sql\n${sqlQuery}\n\`\`\`\n\n**Result:**\n\n${resultTable}`;
      setMessages([...newMessages, { text: botReply, sender: "bot" }]);

    } catch (error) {
      console.error(error);
      setMessages([...newMessages, { text: `Error: ${error.message}`, sender: "bot" }]);
    } finally {
      setLoading(false);
    }
  };

  // Auto-scroll on new messages
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div
      style={{
        maxWidth: "800px",
        margin: "0 auto",
        padding: "20px",
        borderRadius: "12px",
        boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
        background: "linear-gradient(135deg, #eef2f3, #d9e8fc)",
        fontFamily: "Arial, sans-serif",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <h1
        style={{
          fontSize: "24px",
          marginBottom: "20px",
          textAlign: "center",
          color: "#333",
        }}
      >
        Om's Chatbot for Chatting with Database
      </h1>
      <p
        style={{
          textAlign: "center",
          color: "#888",
          fontSize: "14px",
          marginBottom: "10px",
        }}
      >
        Disclaimer: Om's chatbot fetches data from you Database and use Gemini API but
        doesn't guarantee accuracy.
      </p>
      <div
        ref={chatContainerRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "15px",
          background: "linear-gradient(135deg, #f9f9f9, #e6ecf0)",
          borderRadius: "10px",
          marginBottom: "20px",
          display: "flex",
          flexDirection: "column",
          boxShadow: "inset 0 2px 6px rgba(0,0,0,0.1)",
        }}
      >
        {messages.map((msg, idx) => (
          <div
            key={idx}
            style={{
              padding: "12px",
              marginBottom: "12px",
              borderRadius: "12px",
              background:
                msg.sender === "user"
                  ? "linear-gradient(135deg, rgb(105, 79, 254), rgb(69, 200, 252))"
                  : "linear-gradient(135deg, #e0e0e0, #f1f1f1)",
              color: msg.sender === "user" ? "white" : "black",
              alignSelf: msg.sender === "user" ? "flex-end" : "flex-start",
              maxWidth: "80%",
              wordWrap: "break-word",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            }}
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code: CodeBlock,
                table: ({ node, ...props }) => <table style={tableStyle} {...props} />,
                th: ({ node, ...props }) => <th style={thStyle} {...props} />,
                td: ({ node, ...props }) => <td style={tdStyle} {...props} />,
                tr: TableRow,
              }}
              disallowedElements={["script"]}
              skipHtml
            >
              {msg.text}
            </ReactMarkdown>
            {msg.chartData && (
              <div style={{ marginTop: "10px" }}>
                <Bar
                  data={msg.chartData}
                  options={{
                    responsive: true,
                    plugins: {
                      legend: { position: "top" },
                      title: { display: true, text: "AQI Data" },
                    },
                  }}
                />
              </div>
            )}
          </div>
        ))}
        {loading && <p style={{ color: "#888", fontSize: "14px" }}>Thinking...</p>}
      </div>
      <div
        style={{
          display: "flex",
          gap: "12px",
          alignItems: "flex-end",
        }}
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder="Type your question or SQL query..."
          rows={1}
          style={{
            flex: 1,
            resize: "none",
            padding: "12px",
            fontSize: "15px",
            borderRadius: "10px",
            border: "1px solid #ccc",
            boxShadow: "inset 0 2px 4px rgba(0,0,0,0.05)",
            fontFamily: "Consolas, monospace",
            maxHeight: "120px",
            overflowY: "auto",
          }}
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          style={{
            backgroundColor: "#15479E",
            color: "white",
            border: "none",
            padding: "12px 20px",
            borderRadius: "10px",
            cursor: loading || !input.trim() ? "not-allowed" : "pointer",
            fontWeight: "600",
            fontSize: "16px",
            userSelect: "none",
            boxShadow: loading ? "none" : "0 2px 8px rgba(21,71,158,0.5)",
            transition: "background-color 0.3s ease",
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default Chatbot;
