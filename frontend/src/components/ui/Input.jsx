// src/components/ui/Input.jsx
export const Input = ({
  label, name, type = 'text', placeholder,
  value, onChange, error, hint,
  icon: Icon, required = false,
  className = '', disabled = false,
  ...props
}) => (
  <div className={`flex flex-col gap-1.5 ${className}`}>
    {label && (
      <label htmlFor={name} className="text-sm font-medium text-gray-300">
        {label}
        {required && <span className="text-rose ml-1">*</span>}
      </label>
    )}
    <div className="relative">
      {Icon && (
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500">
          <Icon size={16} />
        </div>
      )}
      <input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
        required={required}
        className={`input-field ${Icon ? 'pl-10' : ''}
                    ${error ? 'border-rose/50 focus:border-rose focus:ring-rose/20' : ''}
                    ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        {...props}
      />
    </div>
    {error && <p className="text-rose text-xs">{error}</p>}
    {hint && !error && <p className="text-gray-500 text-xs">{hint}</p>}
  </div>
)

export const Textarea = ({
  label, name, placeholder, value, onChange,
  error, rows = 4, className = '', ...props
}) => (
  <div className={`flex flex-col gap-1.5 ${className}`}>
    {label && (
      <label htmlFor={name} className="text-sm font-medium text-gray-300">{label}</label>
    )}
    <textarea
      id={name}
      name={name}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      rows={rows}
      className={`input-field resize-none ${error ? 'border-rose/50' : ''}`}
      {...props}
    />
    {error && <p className="text-rose text-xs">{error}</p>}
  </div>
)

export const Select = ({
  label, name, value, onChange,
  options = [], error, className = '', ...props
}) => (
  <div className={`flex flex-col gap-1.5 ${className}`}>
    {label && (
      <label htmlFor={name} className="text-sm font-medium text-gray-300">{label}</label>
    )}
    <select
      id={name}
      name={name}
      value={value}
      onChange={onChange}
      className="input-field bg-base-600 appearance-none cursor-pointer"
      {...props}
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value} className="bg-base-500">
          {opt.label}
        </option>
      ))}
    </select>
    {error && <p className="text-rose text-xs">{error}</p>}
  </div>
)
