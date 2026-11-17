import styled from "styled-components";

const Toggle = styled.label`
  position: relative;
  display: inline-block;
  width: 60px;
  height: 34px;
`;

const Checkbox = styled.input`
  opacity: 0;
  width: 0;
  height: 0;

  &:checked + span {
    background-color: #ff1694;
  }

  &:checked + span::before {
    transform: translateX(26px);
  }
`;

const Slider = styled.span`
  position: absolute;
  inset: 0;
  cursor: pointer;

  background-color: #B1B1B1;
  border-radius: 34px;

  transition: 0.3s;

  &::before {
    content: "";
    position: absolute;

    height: 26px;
    width: 26px;

    left: 4px;
    bottom: 4px;

    background-color: white;
    border-radius: 50%;

    transition: 0.3s;
  }
`;

interface ToggleSwitchProps {
  checked: boolean;
  onChange: () => void;
}

function ToggleSwitch({ checked, onChange }: ToggleSwitchProps) {
  return (
    <Toggle>
      <Checkbox
        type="checkbox"
        checked={checked}
        onChange={onChange}
      />

      <Slider />
    </Toggle>
  );
}

export default ToggleSwitch;
