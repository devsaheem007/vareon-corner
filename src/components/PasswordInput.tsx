import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

/** A password box with an eye button, so people can check what they typed before submitting. */
export default function PasswordInput({
  className = "",
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={shown ? "text" : "password"} className={`${className} pr-11`} />
      <button
        type="button"
        onClick={() => setShown((v) => !v)}
        aria-label={shown ? "Hide password" : "Show password"}
        aria-pressed={shown}
        className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-white/45 transition-colors hover:text-white"
      >
        {shown ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  );
}
